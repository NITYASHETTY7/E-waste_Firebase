import { Injectable, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private s3: S3Client;
  private privateBucket =
    process.env.S3_PRIVATE_BUCKET || 'traventions-private-s3';
  private publicBucket =
    process.env.S3_PUBLIC_BUCKET || 'traventions-public-s3';

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(
    file: Express.Multer.File,
    folder: string,
    isPublic = false,
    customKey?: string,
  ): Promise<{ key: string; bucket: string; url?: string }> {
    if (!file) throw new BadRequestException('No file provided');

    const bucket = isPublic ? this.publicBucket : this.privateBucket;
    const ext = file.originalname.split('.').pop();
    const key = customKey || `${folder}/${randomUUID()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = isPublic
      ? `https://${bucket}.s3.amazonaws.com/${key}`
      : undefined;

    return { key, bucket, url };
  }

  async getSignedUrl(
    key: string,
    bucket?: string,
    expiresIn = 3600,
  ): Promise<string> {
    const b = (bucket && bucket !== 'undefined' && bucket !== 'ecoloop-uploads') ? bucket : this.privateBucket;
    const command = new GetObjectCommand({ Bucket: b, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async getFileStream(key: string, bucket?: string): Promise<Readable> {
    const b = (bucket && bucket !== 'undefined' && bucket !== 'ecoloop-uploads') ? bucket : this.privateBucket;
    const command = new GetObjectCommand({ Bucket: b, Key: key });
    const response = await this.s3.send(command);
    return response.Body as Readable;
  }

  async delete(key: string, bucket?: string): Promise<void> {
    const b = (bucket && bucket !== 'undefined' && bucket !== 'ecoloop-uploads') ? bucket : this.privateBucket;
    await this.s3.send(new DeleteObjectCommand({ Bucket: b, Key: key }));
  }

  async listObjects(
    prefix: string,
    bucket?: string,
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const b = (bucket && bucket !== 'undefined' && bucket !== 'ecoloop-uploads') ? bucket : this.privateBucket;
    const response = await this.s3.send(
      new ListObjectsV2Command({ Bucket: b, Prefix: prefix }),
    );
    return (response.Contents || [])
      .filter((obj) => obj.Key && !obj.Key.endsWith('/'))
      .map((obj) => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));
  }

  getPrivateBucket(): string {
    return this.privateBucket;
  }
}
