import { OSSAbstract } from "../../service-locator/service/oss-abstract";
import path from "path";
import { aliOSSClient } from "./ali-oss-client";
import { createLoggerService } from "../../../logger";
import { addMinutes } from "date-fns/fp";
import { StorageService } from "../../../constants/Config";
import crypto from "crypto";
import { FError } from "../../../error/ControllerError";
import { ErrorCode } from "../../../ErrorCode";

export class AliOSSService extends OSSAbstract {
    private readonly logger = createLoggerService<"AliOSS">({
        serviceName: "AliOSS",
        ids: this.ids,
    });

    // public readonly domain = `http://${StorageService.oss.bucket}.${StorageService.oss.endpoint}`;
    // public readonly domain = `http://${StorageService.oss.endpoint}`;
    public readonly domain = `http://$`;

    public constructor(private readonly ids: IDS) {
        super();
    }

    public async exists(filePath: string): Promise<boolean> {
        try {
            await aliOSSClient.head(filePath);
            return true;
        } catch {
            return false;
        }
    }

    public async assertExists(filePath: string): Promise<void> {
        const result = await this.exists(filePath);

        if (!result) {
            this.logger.info("oss file not found", {
                AliOSS: {
                    filePath,
                },
            });
            throw new FError(ErrorCode.FileNotFound);
        }
    }

    public async remove(fileList: string | string[]): Promise<void> {
        this.logger.debug("remove file", {
            AliOSS: {
                removeFileList: Array.isArray(fileList) ? fileList.join(", ") : fileList,
            },
        });

        if (!Array.isArray(fileList)) {
            const result = await aliOSSClient.delete(this.removeDomain(fileList));

            this.logger.debug("remove file done", {
                AliOSS: {
                    removeFile: fileList,
                    removeStatus: result.res.status,
                },
            });
            return;
        }

        const list = fileList.map(file => this.removeDomain(file));

        await aliOSSClient.deleteMulti(list);

        const newOSSFilePathList: string[] = [];

        for (const filePath of list) {
            const suffix = path.extname(filePath);
            const fileUUID = path.basename(filePath, suffix);
            const fileName = `${fileUUID}${suffix}`;

            // old: PREFIX/UUID.png
            // new: PREFIX/2021-10/12/UUID/UUID.png
            if (filePath.endsWith(`${fileUUID}/${fileName}`)) {
                newOSSFilePathList.push(filePath.substring(0, filePath.length - fileName.length));
            }
        }

        if (newOSSFilePathList.length !== 0) {
            this.logger.debug("will remove directory", {
                AliOSS: {
                    newOSSFilePathList: newOSSFilePathList.join(", "),
                },
            });
        } else {
            this.logger.debug("not remove directory");
        }

        for (const directory of newOSSFilePathList) {
            await this.recursionRemove(directory);
        }
    }

    public async recursionRemove(directory: string, marker?: string): Promise<void> {
        const files = await aliOSSClient.list(
            {
                prefix: directory,
                marker: marker,
                "max-keys": 500,
            },
            {},
        );

        if (files.objects && files.objects.length !== 0) {
            const names = files.objects.map(file => file.name);
            this.logger.debug("remove files path", {
                AliOSS: {
                    removeFilesPath: names.join(", "),
                },
            });
            await aliOSSClient.deleteMulti(names);
        }

        if (!files.isTruncated) {
            return;
        }

        await this.recursionRemove(directory, files.nextMarker);
    }

    public async rename(filePath: string, newFileName: string): Promise<void> {
        await aliOSSClient.copy(filePath, filePath, {
            headers: {
                "Content-Disposition": AliOSSService.toDispositionFileNameEncode(newFileName),
            },
        });
    }

    public policyTemplate(
        fileName: string,
        filePath: string,
        fileSize: number,
        expiration = 60 * 2,
    ): {
        policy: string;
        signature: string;
    } {
        const policyString = JSON.stringify({
            expiration: addMinutes(expiration)(new Date()).toISOString(),
            conditions: [
                {
                    // bucket: StorageService.oss.bucket,
                    bucket: StorageService.s3.bucket,
                },
                ["content-length-range", fileSize, fileSize],
                ["eq", "$key", filePath],
                ["eq", "$Content-Disposition", AliOSSService.toDispositionFileNameEncode(fileName)],
            ],
        });

        const policy = Buffer.from(policyString).toString("base64");
        const signature = crypto
            // .createHmac("sha1", StorageService.oss.accessKeySecret)
            .createHmac("sha1", StorageService.s3.accessKeySecret)
            .update(policy)
            .digest("base64");

        return {
            policy,
            signature,
        };
    }

    private static toDispositionFileNameEncode(str: string): string {
        const encodeFileName = encodeURIComponent(str);
        return `attachment; filename="${encodeFileName}"; filename*=UTF-8''${encodeFileName}`;
    }
}

// import {
//     S3Client,
//     HeadObjectCommand,
//     DeleteObjectCommand,
//     DeleteObjectsCommand,
//     ListObjectsV2Command,
//     CopyObjectCommand,
//     PutObjectCommand,
//     GetObjectCommand,
//   } from "@aws-sdk/client-s3";
//   import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
//   import path from "path";
//   import { StorageService } from "../../../constants/Config";
//   import { createLoggerService } from "../../../logger";
//   import { addMinutes } from "date-fns/fp";
//   import crypto from "crypto";
//   import { FError } from "../../../error/ControllerError";
//   import { ErrorCode } from "../../../ErrorCode";
//   import { OSSAbstract } from "../../service-locator/service/oss-abstract";
// //   import { IDS } from "../../../types/IDS";
  
//   export class S3StorageService extends OSSAbstract {
//     private readonly logger = createLoggerService<"S3Storage">({
//       serviceName: "S3Storage",
//       ids: this.ids,
//     });
  
//     private readonly s3Client: S3Client;
//     public readonly domain: string;
  
//     public constructor(private readonly ids: IDS) {
//       super();
//       this.s3Client = new S3Client({
//         region: StorageService.oss.region,
//         endpoint: StorageService.oss.endpoint,
//         credentials: {
//           accessKeyId: StorageService.oss.accessKey,
//           secretAccessKey: StorageService.oss.accessKeySecret, 
//         },
//         forcePathStyle: true, // Required for MinIO
//       });
//       this.domain = StorageService.oss.endpoint;
//     }
  
//     public async exists(filePath: string): Promise<boolean> {
//       try {
//         await this.s3Client.send(
//           new HeadObjectCommand({
//             Bucket: StorageService.oss.bucket,
//             Key: filePath,
//           })
//         );
//         return true;
//       } catch (error) {
//         if ((error as { name: string }).name === "NotFound") {
//           return false;
//         }
//         throw error;
//       }
//     }
  
//     public async assertExists(filePath: string): Promise<void> {
//       const exists = await this.exists(filePath);
//       if (!exists) {
//         this.logger.info("file not found in storage", {
//           S3Storage: {
//             filePath,
//           },
//         });
//         throw new FError(ErrorCode.FileNotFound);
//       }
//     }
  
//     public async remove(fileList: string | string[]): Promise<void> {
//       const filesToDelete = Array.isArray(fileList) ? fileList : [fileList];
  
//       this.logger.debug("removing files", {
//         S3Storage: {
//           files: filesToDelete.join(", "),
//         },
//       });
  
//       if (filesToDelete.length === 1) {
//         await this.s3Client.send(
//           new DeleteObjectCommand({
//             Bucket: StorageService.oss.bucket,
//             Key: filesToDelete[0],
//           })
//         );
//       } else {
//         await this.s3Client.send(
//           new DeleteObjectsCommand({
//             Bucket: StorageService.oss.bucket,
//             Delete: {
//               Objects: filesToDelete.map((Key) => ({ Key })),
//               Quiet: true,
//             },
//           })
//         );
//       }
  
//       // Handle directory cleanup if needed
//       const directoriesToCheck = new Set<string>();
//       for (const filePath of filesToDelete) {
//         const dir = path.dirname(filePath);
//         if (dir !== ".") {
//           directoriesToCheck.add(dir);
//         }
//       }
  
//       for (const directory of directoriesToCheck) {
//         await this.cleanupEmptyDirectory(directory);
//       }
//     }
  
//     private async cleanupEmptyDirectory(directory: string): Promise<void> {
//       try {
//         const { Contents } = await this.s3Client.send(
//           new ListObjectsV2Command({
//             Bucket: StorageService.oss.bucket,
//             Prefix: directory + "/",
//             MaxKeys: 1,
//           })
//         );
  
//         if (!Contents || Contents.length === 0) {
//           await this.s3Client.send(
//             new DeleteObjectCommand({
//               Bucket: StorageService.oss.bucket,
//               Key: directory + "/",
//             })
//           );
//           this.logger.debug("removed empty directory", {
//             S3Storage: {
//               directory,
//             },
//           });
//         }
//       } catch (error) {
//         this.logger.error("failed to check/clean directory", {
//           S3Storage: {
//             directory,
//             error: (error as Error).message,
//           },
//         });
//       }
//     }
  
//     public async rename(filePath: string, newFileName: string): Promise<void> {
//       const newKey = filePath; // Same path, just updating metadata
//       const copySource = `/${StorageService.oss.bucket}/${filePath}`;
  
//       await this.s3Client.send(
//         new CopyObjectCommand({
//           Bucket: StorageService.oss.bucket,
//           CopySource: copySource,
//           Key: newKey,
//           MetadataDirective: "REPLACE",
//           ContentDisposition: S3StorageService.toDispositionFileNameEncode(
//             newFileName
//           ),
//         })
//       );
//     }
  
//     public async getFileURL(filePath: string, expiresInMinutes = 60): Promise<string> {
//       const command = new GetObjectCommand({
//         Bucket: StorageService.oss.bucket,
//         Key: filePath,
//         ResponseContentDisposition: S3StorageService.toDispositionFileNameEncode(
//           path.basename(filePath)
//         ),
//       });
  
//       return getSignedUrl(this.s3Client, command, {
//         expiresIn: expiresInMinutes * 60,
//       });
//     }
  
//     public async putFile(
//       filePath: string,
//       fileContent: Buffer | string,
//       fileName: string
//     ): Promise<void> {
//       await this.s3Client.send(
//         new PutObjectCommand({
//           Bucket: StorageService.oss.bucket,
//           Key: filePath,
//           Body: fileContent,
//           ContentDisposition: S3StorageService.toDispositionFileNameEncode(fileName),
//         })
//       );
//     }
  
//     public policyTemplate(
//       fileName: string,
//       filePath: string,
//       fileSize: number,
//       expirationMinutes = 120
//     ): {
//       policy: string;
//       signature: string;
//     } {
//       const expirationDate = addMinutes(expirationMinutes)(new Date());
//       const policy = {
//         expiration: expirationDate.toISOString(),
//         conditions: [
//           { bucket: StorageService.oss.bucket },
//           ["content-length-range", fileSize, fileSize],
//           ["eq", "$key", filePath],
//           [
//             "eq",
//             "$Content-Disposition",
//             S3StorageService.toDispositionFileNameEncode(fileName),
//           ],
//         ],
//       };
  
//       const policyString = JSON.stringify(policy);
//       const policyBase64 = Buffer.from(policyString).toString("base64");
//       const signature = crypto
//         .createHmac("sha1", StorageService.oss.accessKeySecret)
//         .update(policyBase64)
//         .digest("base64");
  
//       return {
//         policy: policyBase64,
//         signature,
//       };
//     }
  
//     private static toDispositionFileNameEncode(str: string): string {
//       const encodeFileName = encodeURIComponent(str);
//       return `attachment; filename="${encodeFileName}"; filename*=UTF-8''${encodeFileName}`;
//     }
//   }