// Type definitions for the API responses and parameters
interface PoolInfo {
  // Define pool info interface based on actual API response
  [key: string]: any;
}

interface PoolInfoResponse {
  error?: string;
  [key: string]: any;
}

interface PoolInfoByMintParams {
  mint1: string;
  poolType?: string;
  poolSortField?: string;
  sortType?: string;
  pageSize?: number;
  page?: number;
}

/**
 * Fetches pool information by pool ID
 */
async function getPoolInfoById(poolId: string): Promise<PoolInfoResponse> {
  const baseUrl = 'https://api-v3.raydium.io/pools/info/ids';
  // Fetch is used in the browser to interact with APIs over HTTP(S)
  // Fetch works well for this and is promise based<sup data-citation="5" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://dev.to/simonireilly/fetch-with-typescript-for-better-http-api-clients-2d71#:~:text=Fetch%20is%20used%20in%20the,this%2E%20It%20is%20promise%20based%2E" target="_blank" title="Fetch with Typescript for better HTTP API Clients">5</a></sup>

  try {
    // Fetch is a promise-based HTTP client that's built into modern browsers
    // No need to install additional dependencies<sup data-citation="8" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://medium.com/@johnnyJK/axios-vs-fetch-api-selecting-the-right-tool-for-http-requests-ecb14e39e285#:~:text=Fetch%2C%20like%20Axios%2C%20is%20a,to%20install%20or%20import%20anything%2E" target="_blank" title="Axios vs. Fetch API: Selecting the Right Tool for HTTP ...">8</a></sup>
    
    const response = await fetch(`${baseUrl}?ids=${poolId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    return {
      error: `Failed to fetch pool info: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Fetches pool information by mint address with optional parameters
 */
async function getPoolInfoByMint({
  mint1,
  poolType = 'all',
  poolSortField = 'default',
  sortType = 'desc',
  pageSize = 100,
  page = 1
}: PoolInfoByMintParams): Promise<PoolInfoResponse> {
  const baseUrl = 'https://api-v3.raydium.io/pools/info/mint';

  // When working with an API, you often want type safety
  // Create a generic way to handle fetch that can be extended for different use cases<sup data-citation="5" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://dev.to/simonireilly/fetch-with-typescript-for-better-http-api-clients-2d71#:~:text=My%20goal%20is%20to%20create,for%20their%20own%20use%20cases%2E" target="_blank" title="Fetch with Typescript for better HTTP API Clients">5</a></sup>

  // Construct URL with query parameters
  const params = new URLSearchParams({
    mint1,
    poolType,
    poolSortField,
    sortType: sortType.toString(),
    pageSize: pageSize.toString(),
    page: page.toString()
  });

  try {
    const response = await fetch(`${baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Handle both HTTP response errors (401/404 etc.)
    // and fetch errors (failed to fetch)
    // These aren't server specific<sup data-citation="5" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://dev.to/simonireilly/fetch-with-typescript-for-better-http-api-clients-2d71#:~:text=in%20my%20opinion%20you%20should,it%2E%20Those%20aren%27t%20server%20specific%2E" target="_blank" title="Fetch with Typescript for better HTTP API Clients">5</a></sup>
    return {
      error: `Failed to fetch pair address: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Example usage:
/*
// Get pool info by ID
const poolInfo = await getPoolInfoById("your-pool-id");

// Get pool info by mint address
const mintInfo = await getPoolInfoByMint({
  mint1: "your-mint-address",
  poolType: "all",
  pageSize: 50,
  page: 1
});
*/

export { getPoolInfoById, getPoolInfoByMint };
