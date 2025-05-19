// import s3 from "";
import { StorageService } from "../../../constants/Config";

export const awsS3 = {
    bucket: StorageService.s3.bucket,
    region: StorageService.s3.region,
    // endpoint: StorageService.,
    accessKeyId: StorageService.s3.accessKey,
    accessKeySecret: StorageService.s3.accessKeySecret,
    secure: true,
};