import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'sheet_cell' })
export class SheetCellEntity extends BaseEntity {
  @Index()
  @Column({ length: 64, comment: '内部文件ID' })
  fileId: string;

  @Column({ length: 128, comment: 'Sheet名称' })
  sheetName: string;

  @Column({ comment: '行号' })
  rowIndex: number;

  @Column({ comment: '列号' })
  columnIndex: number;

  @Column({ length: 16, comment: '单元格坐标' })
  address: string;

  @Column({ type: 'mediumtext', nullable: true, comment: '单元格内容' })
  value: string;
}
