export interface GestaoSeedUrl {
  name: string;
  value: string;
}

export interface GestaoSeedEnvironment {
  databaseUrls?: readonly GestaoSeedUrl[];
  nodeEnv?: string;
  profile?: string;
  seedDevelopmentData?: string;
}

export function validateGestaoSeedEnvironment(
  environment: GestaoSeedEnvironment
): {
  connectionString: string;
  databaseName: string;
  profile: "functional" | "visual";
};
