import { Address } from "viem";
import { publicClient } from "../providers";
import { config } from "./config";
import { StonkTokenRegistryAbi } from "./abis";

export type ListedToken = {
  address: Address;
  symbol: string;
  decimals: number;
  logoURI?: string;
  metadataURI?: string;
};

export async function fetchWhitelistedTokens(): Promise<ListedToken[]> {
  if (!config.tokenRegistry) return [];

  const count = (await publicClient.readContract({
    address: config.tokenRegistry,
    abi: StonkTokenRegistryAbi,
    functionName: "tokenCount"
  })) as bigint;

  const out: ListedToken[] = [];
  // Avoid bigint->number footguns (even though tokenCount will be small in practice).
  for (let i = 0n; i < count; i++) {
    const addr = (await publicClient.readContract({
      address: config.tokenRegistry,
      abi: StonkTokenRegistryAbi,
      functionName: "tokenAt",
      args: [i]
    })) as Address;

    const info = (await publicClient.readContract({
      address: config.tokenRegistry,
      abi: StonkTokenRegistryAbi,
      functionName: "getToken",
      args: [addr]
    })) as any;

    if (!info?.whitelisted) continue;
    out.push({
      address: addr,
      symbol: info.symbol as string,
      decimals: Number(info.decimals),
      logoURI: (info.logoURI as string) || undefined,
      metadataURI: (info.metadataURI as string) || undefined
    });
  }
  return out;
}

