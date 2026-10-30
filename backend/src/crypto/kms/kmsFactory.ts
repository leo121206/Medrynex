import { IKeyManagementService } from './IKeyManagementService';
import { localKms, LocalKeyManagementService } from './LocalKeyManagementService';
import { AwsKeyManagementService } from './AwsKeyManagementService';

/**
 * Factory for instantiating the appropriate Key Management Service.
 * Supports 'local' (development/native runtime) and 'aws' (cloud enterprise KMS).
 */
export function getKmsProvider(providerName?: string): IKeyManagementService {
  const provider = (providerName || process.env.KMS_PROVIDER || 'local').toLowerCase();

  switch (provider) {
    case 'aws':
    case 'aws-kms':
      return new AwsKeyManagementService();
    case 'local':
      return localKms;
    default:
      throw new Error(
        `Unsupported KMS provider: '${provider}'. Valid providers: 'local', 'aws'. ` +
        `Silent fallback to local key store is strictly disabled.`
      );
  }
}

export { localKms, LocalKeyManagementService, AwsKeyManagementService };
