import OSS from "ali-oss";
import { StorageService } from "../../../constants/Config";

export const aliOSSClient = new OSS({
    bucket: StorageService.oss.bucket,
    region: StorageService.oss.region,
    endpoint: StorageService.oss.endpoint,
    accessKeyId: StorageService.oss.accessKey,
    accessKeySecret: StorageService.oss.accessKeySecret,
    secure: true,
    // cname: false,
    // // signatureVersion: "v4",
    // s3ForcePathStyle: true,
    // s3BucketEndpoint: false,
    // signatureAlgorithm: "AWS4-HMAC-SHA256",
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