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

  const indices = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const addrs = await Promise.all(
    indices.map((i) =>
      publicClient.readContract({
        address: config.tokenRegistry,
        abi: StonkTokenRegistryAbi,
        functionName: "tokenAt",
        args: [i]
      }) as Promise<Address>
    )
  );

  const infos = await Promise.all(
    addrs.map((addr) =>
      publicClient
        .readContract({
          address: config.tokenRegistry,
          abi: StonkTokenRegistryAbi,
          functionName: "getToken",
          args: [addr]
        })
        .catch(() => null)
    )
  );

  const out: ListedToken[] = [];
  for (let i = 0; i < addrs.length; i++) {
    const info = infos[i] as any;
    if (!info?.whitelisted) continue;
    out.push({
      address: addrs[i],
      symbol: info.symbol as string,
      decimals: Number(info.decimals),
      logoURI: (info.logoURI as string) || undefined,
      metadataURI: (info.metadataURI as string) || undefined
    });
  }
  return out;
}

