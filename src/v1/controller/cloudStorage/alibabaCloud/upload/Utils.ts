import { CloudStorageConfigsDAO } from "../../../../../dao";
import { CloudStorage, StorageService  } from "../../../../../constants/Config";
// import { CloudStorage, StorageService } from "../../../../../constants/Config";
import path from "path";
import { format } from "date-fns/fp";

export const checkTotalUsage = async (
    userUUID: string,
    currentFileSize: number,
): Promise<{
    fail: boolean;
    totalUsage: number;
}> => {
    const cloudStorageConfigInfo = await CloudStorageConfigsDAO().findOne(["total_usage"], {
        user_uuid: userUUID,
    });

    const totalUsage = (Number(cloudStorageConfigInfo?.total_usage) || 0) + currentFileSize;

    return {
        fail: totalUsage > CloudStorage.totalSize,
        totalUsage,
    };
};

export const getFilePath = (fileName: string, fileUUID: string): string => {
    const datePath = format("yyyy-MM/dd")(Date.now());
    // e.g: PREFIX/2021-10/19/UUID/UUID.txt
    return `${CloudStorage.prefixPath}/${datePath}/${fileUUID}/${fileUUID}${path.extname(
        fileName,
    )}`;
};

export const getOSSDomain = (): string => {
    // return `https://${StorageService.oss.endpoint}`;
    // return `http://${StorageService.oss.endpoint}`;
    // console.log("StorageService.s3.endpoint", StorageService.s3.endpoint);
    return `https://${StorageService.s3.bucket}.s3.${StorageService.s3.region}.amazonaws.com`;
    // return "hello: string"
};

export const getOSSFileURLPath = (filePath: string): string => {
    return `${getOSSDomain()}/${filePath}`;
};
