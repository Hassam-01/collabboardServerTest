import { S3Client, HeadObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { OSSAbstract } from "../../service-locator/service/oss-abstract";
import path from "path";
import { createLoggerService } from "../../../logger";
import { addMinutes } from "date-fns/fp";
import { StorageService } from "../../../constants/Config";
import crypto from "crypto";
import { FError } from "../../../error/ControllerError";
import { ErrorCode } from "../../../ErrorCode";

console.log("StorageService.s3.bucket:  hello ", StorageService.s3.bucket);
export class AWSS3Service extends OSSAbstract {
    private readonly logger = createLoggerService<"AWSS3">({
        serviceName: "AWSS3",
        ids: this.ids,
    });

    // AWS S3 Domain: https://bucket.s3.region.amazonaws.com
    public readonly domain = `https://${StorageService.s3.bucket}.s3.${StorageService.s3.region}.amazonaws.com`;

    private readonly s3Client: S3Client;

    public constructor(private readonly ids: IDS) {
        super();
        this.s3Client = new S3Client({
            region: StorageService.s3.region,
            credentials: {
                accessKeyId: StorageService.s3.accessKey,
                secretAccessKey: StorageService.s3.accessKeySecret,
            },
        });
    }

    public async exists(filePath: string): Promise<boolean> {
        try {
            await this.s3Client.send(
                new HeadObjectCommand({
                    Bucket: StorageService.s3.bucket,
                    Key: filePath,
                }),
            );
            return true;
        } catch (error) {
            if ((error as { name: string }).name === "NotFound") {
                return false;
            }
            throw error;
        }
    }

    public async assertExists(filePath: string): Promise<void> {
        const result = await this.exists(filePath);
        if (!result) {
            this.logger.info("S3 file not found", {
                AWSS3: { filePath },
            });
            throw new FError(ErrorCode.FileNotFound);
        }
    }

    public async remove(fileList: string | string[]): Promise<void> {
        const files = Array.isArray(fileList) ? fileList : [fileList];

        this.logger.debug("remove file", {
            AWSS3: { removeFileList: files.join(", ") },
        });

        if (files.length === 1) {
            await this.s3Client.send(
                new DeleteObjectCommand({
                    Bucket: StorageService.s3.bucket,
                    Key: files[0],
                }),
            );
        } else {
            await this.s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: StorageService.s3.bucket,
                    Delete: { Objects: files.map((Key) => ({ Key })) },
                }),
            );
        }

        // Handle directory cleanup (similar to original logic)
        const directories = files
            .filter((filePath) => {
                const suffix = path.extname(filePath);
                const fileUUID = path.basename(filePath, suffix);
                return filePath.endsWith(`${fileUUID}/${fileUUID}${suffix}`);
            })
            .map((filePath) => filePath.substring(0, filePath.lastIndexOf("/")));

        for (const directory of directories) {
            await this.recursionRemove(directory);
        }
    }

    public async recursionRemove(directory: string, continuationToken?: string): Promise<void> {
        const { Contents, IsTruncated, NextContinuationToken } = await this.s3Client.send(
            new ListObjectsV2Command({
                Bucket: StorageService.s3.bucket,
                Prefix: directory,
                ContinuationToken: continuationToken,
                MaxKeys: 500,
            }),
        );

        if (Contents?.length) {
            await this.s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: StorageService.s3.bucket,
                    Delete: { Objects: Contents.map(({ Key }) => ({ Key })) },
                }),
            );
        }

        if (IsTruncated && NextContinuationToken) {
            await this.recursionRemove(directory, NextContinuationToken);
        }
    }

    public async rename(filePath: string, newFileName: string): Promise<void> {
        await this.s3Client.send(
            new CopyObjectCommand({
                Bucket: StorageService.s3.bucket,
                CopySource: `/${StorageService.s3.bucket}/${filePath}`,
                Key: filePath,
                ContentDisposition: AWSS3Service.toDispositionFileNameEncode(newFileName),
            }),
        );
    }

    public policyTemplate(
        fileName: string,
        filePath: string,
        fileSize: number,
        expiration = 60 * 2,
    ): { policy: string; signature: string } {
        // AWS uses a different policy format for presigned URLs.
        // This is a simplified example; for full S3 upload policies, see:
        // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
        const policy = {
            expiration: addMinutes(expiration)(new Date()).toISOString(),
            conditions: [
                { bucket: StorageService.s3.bucket },
                ["content-length-range", fileSize, fileSize],
                { key: filePath },
                { "Content-Disposition": AWSS3Service.toDispositionFileNameEncode(fileName) },
            ],
        };

        const policyString = JSON.stringify(policy);
        const policyBase64 = Buffer.from(policyString).toString("base64");
        const signature = crypto
            .createHmac("sha1", StorageService.s3.accessKeySecret)
            .update(policyBase64)
            .digest("base64");

        return { policy: policyBase64, signature };
    }

    private static toDispositionFileNameEncode(str: string): string {
        const encodeFileName = encodeURIComponent(str);
        return `attachment; filename="${encodeFileName}"; filename*=UTF-8''${encodeFileName}`;
    }
}