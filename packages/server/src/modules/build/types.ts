import type { SelectBuild } from '../../db/schema/index.js';

export interface PreviewInfo {
  url: string;
  port: number;
}

export interface BuildDetail extends SelectBuild {
  projectName?: string;
}
