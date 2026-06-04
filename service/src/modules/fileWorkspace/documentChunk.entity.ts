import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'document_chunk' })
export class DocumentChunkEntity extends BaseEntity {
  @Index()
  @Column({ length: 64, comment: '内部文件ID' })
  fileId: string;

  @Column({ comment: '块序号', default: 0 })
  chunkIndex: number;

  @Column({ comment: '页码', nullable: true })
  pageNumber: number;

  @Column({ length: 128, nullable: true, comment: '段落ID' })
  paragraphId: string;

  @Column({ length: 255, nullable: true, comment: '标题路径' })
  headingPath: string;

  @Column({ type: 'mediumtext', comment: '文本内容' })
  content: string;

  @Column({ type: 'text', nullable: true, comment: '引用定位信息' })
  locator: string;

  @Column({ type: 'text', nullable: true, comment: '向量索引元数据/占位' })
  vectorMetadata: string;
}
