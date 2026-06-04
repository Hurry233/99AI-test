import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'page_preview' })
export class PagePreviewEntity extends BaseEntity {
  @Index()
  @Column({ length: 64, comment: '内部文件ID' })
  fileId: string;

  @Column({ comment: '页码', nullable: true })
  pageNumber: number;

  @Column({ length: 128, nullable: true, comment: 'Sheet名称' })
  sheetName: string;

  @Column({ length: 255, nullable: true, comment: '预览标题' })
  title: string;

  @Column({ type: 'mediumtext', nullable: true, comment: '预览文本' })
  text: string;

  @Column({ type: 'text', nullable: true, comment: '缩略图或预览URL' })
  previewUrl: string;
}
