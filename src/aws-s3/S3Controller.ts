// src/controller/S3Controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AWS_S3 } from "../constants/Config";

const s3 = new S3Client({
  region: AWS_S3.region,
  credentials: {
    accessKeyId: AWS_S3.accessKeyId,
    secretAccessKey: AWS_S3.secretAccessKey,
  },
});

export const getS3PresignedURL = async (
  req: FastifyRequest<{ Body: { key: string } }>,  reply: FastifyReply
) => {
  try {
    const command = new PutObjectCommand({
      Bucket: AWS_S3.bucket,
      Key: req.body.key,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    reply.send({ url });
  } catch (error) {
    console.error("Error generating S3 presigned URL", error);
    reply.status(500).send({ error: "Failed to generate presigned URL" });
  }
};
