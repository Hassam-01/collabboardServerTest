import OSS from "ali-oss";
import { StorageService } from "../../../constants/Config";

// export const aliOSSClient = new OSS({
//     bucket: StorageService.oss.bucket,
//     region: StorageService.oss.region,
//     endpoint: StorageService.oss.endpoint,
//     accessKeyId: StorageService.oss.accessKey,
//     accessKeySecret: StorageService.oss.accessKeySecret,
//     secure: true,
// });
export const aliOSSClient = new OSS({
    bucket: StorageService.s3.bucket,
    region: StorageService.s3.region,
    // endpoint: StorageService.s3.endpoint,
    accessKeyId: StorageService.s3.accessKey,
    accessKeySecret: StorageService.s3.accessKeySecret,
    secure: true,
});

// import { S3Client } from "@aws-sdk/client-s3";
// import { StorageService } from "../../../constants/Config";

// // MinIO (S3-compatible) configuration
// export const s3Client = new S3Client({
//     region: StorageService.oss.region,
//     endpoint: StorageService.oss.endpoint,
//     credentials: {
//         accessKeyId: StorageService.oss.accessKey,
//         secretAccessKey: StorageService.oss.accessKeySecret, // Make sure this is mapped correctly in Config
//     },
//     forcePathStyle: true, // Required for MinIO
// });