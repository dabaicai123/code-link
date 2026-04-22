export interface CodeServerStartResult {
  url: string;
}

export interface CodeServerStopResult {
  success: boolean;
}

export interface CodeServerStatusResult {
  running: boolean;
  url: string | null;
}