/**
 * Skill 类型定义
 * 对应后端动态加载的 skills
 */

export interface Skill {
  /** skill 名称，用于斜杠命令 */
  name: string;
  /** skill 描述 */
  description: string;
  /** skill 来源：plugin 或内置 */
  source?: 'plugin' | 'builtin';
  /** skill 版本 */
  version?: string;
}

export interface SkillListResponse {
  skills: Skill[];
}
