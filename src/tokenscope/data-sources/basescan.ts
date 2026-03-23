import axios from 'axios';
import { BASESCAN_API } from '../../config/api-endpoints.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('basescan');

export interface BasescanResult {
  available: boolean;
  is_verified: boolean;
  contract_name: string;
  compiler_version: string;
  deployer_address: string;
  deploy_tx_hash: string;
  deployer_contract_count: number;
  deployer_age_days: number;
  flags: string[];
}

const EMPTY_RESULT: BasescanResult = {
  available: false,
  is_verified: false,
  contract_name: '',
  compiler_version: '',
  deployer_address: '',
  deploy_tx_hash: '',
  deployer_contract_count: 0,
  deployer_age_days: 0,
  flags: [],
};

/**
 * Get contract verification status and deployer info from Basescan.
 */
export async function getContractInfo(address: string): Promise<BasescanResult> {
  const apiKey = BASESCAN_API.apiKey;

  try {
    // Parallel: contract source + creation info
    const [sourceResp, creationResp] = await Promise.allSettled([
      axios.get(BASESCAN_API.baseUrl, {
        params: {
          module: 'contract',
          action: 'getsourcecode',
          address,
          apikey: apiKey || undefined,
        },
        timeout: 5000,
      }),
      axios.get(BASESCAN_API.baseUrl, {
        params: {
          module: 'contract',
          action: 'getcontractcreation',
          contractaddresses: address,
          apikey: apiKey || undefined,
        },
        timeout: 5000,
      }),
    ]);

    const flags: string[] = [];
    let isVerified = false;
    let contractName = '';
    let compilerVersion = '';
    let deployerAddress = '';
    let deployTxHash = '';

    // Parse source code response
    if (sourceResp.status === 'fulfilled') {
      const sourceData = sourceResp.value.data?.result?.[0];
      if (sourceData) {
        isVerified = !!sourceData.SourceCode && sourceData.SourceCode !== '';
        contractName = sourceData.ContractName ?? '';
        compilerVersion = sourceData.CompilerVersion ?? '';
        if (!isVerified) flags.push('contract_not_verified');
      }
    }

    // Parse creation response
    if (creationResp.status === 'fulfilled') {
      const creationData = creationResp.value.data?.result?.[0];
      if (creationData) {
        deployerAddress = creationData.contractCreator ?? '';
        deployTxHash = creationData.txHash ?? '';
      }
    }

    // If we got the deployer, check their activity
    let deployerContractCount = 0;
    let deployerAgeDays = 0;

    if (deployerAddress) {
      try {
        const txResp = await axios.get(BASESCAN_API.baseUrl, {
          params: {
            module: 'account',
            action: 'txlist',
            address: deployerAddress,
            startblock: 0,
            endblock: 99999999,
            page: 1,
            offset: 50, // last 50 transactions
            sort: 'desc',
            apikey: apiKey || undefined,
          },
          timeout: 5000,
        });

        const txs = txResp.data?.result ?? [];
        if (Array.isArray(txs)) {
          // Count contract creations (to field is empty for contract creation)
          deployerContractCount = txs.filter(
            (tx: Record<string, unknown>) => (tx.to as string) === '' || (tx.to as string) === null,
          ).length;

          // Deployer age from earliest tx
          if (txs.length > 0) {
            const oldestTx = txs[txs.length - 1];
            const timestamp = parseInt(oldestTx.timeStamp as string, 10) * 1000;
            if (timestamp > 0) {
              deployerAgeDays = Math.round((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
            }
          }

          // Flag serial deployers
          if (deployerContractCount > 10) {
            flags.push('serial_deployer');
          }
          if (deployerAgeDays < 7) {
            flags.push('new_deployer_wallet');
          }
        }
      } catch {
        // Non-critical, continue
      }
    }

    return {
      available: true,
      is_verified: isVerified,
      contract_name: contractName,
      compiler_version: compilerVersion,
      deployer_address: deployerAddress,
      deploy_tx_hash: deployTxHash,
      deployer_contract_count: deployerContractCount,
      deployer_age_days: deployerAgeDays,
      flags,
    };
  } catch (e: unknown) {
    log.error(`Basescan API error for ${address}:`, e);
    return { ...EMPTY_RESULT, available: false };
  }
}
