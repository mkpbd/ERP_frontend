export interface AppEnvironment {
  readonly production: boolean;
  /** Base URL of the versioned REST API, without a trailing slash. */
  readonly apiBaseUrl: string;
}
