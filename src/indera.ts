import { config } from 'dotenv'

config()

import Command from '@oclif/command'
import cli from 'cli-ux'
import { constants, Contract, providers, Wallet } from 'ethers'
import { FACTORY_ADDRESS, MIN_LIQUIDITY, ROUTER_ADDRESS, RPC_URL, WBNB_ADDRESS } from './constants'

import BEP20 from './abis/BEP20.json'
import PancakeFactory from './abis/PancakeFactory.json'
import PancakeRouter from './abis/PancakeRouter.json'
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils'

const provider = new providers.JsonRpcProvider(RPC_URL)
const wallet = new Wallet(process.env.PRIVATE_KEY as string, provider)

type BotParam = {
  ctx: Command
  targetAddress: string
  amountIn: number
  executeTrade: boolean
}

export const executeBot = async ({ targetAddress, ctx, amountIn, executeTrade }: BotParam) => {
  const wbnb = new Contract(WBNB_ADDRESS, BEP20, wallet)
  //   const target = new Contract(targetAddress, BEP20, wallet)
  const router = new Contract(ROUTER_ADDRESS, PancakeRouter, wallet)
  const factory = new Contract(FACTORY_ADDRESS, PancakeFactory, wallet)

  //   ctx.log('Finding Pair...')
  cli.action.start('Finding Pair')

  const loadPair = async () => {
    const pair = await factory.getPair(WBNB_ADDRESS, targetAddress)

    if (pair === constants.AddressZero) {
      await loadPair()

      return
    }

    cli.action.stop()

    cli.action.start('Pair Found! checking for liquidity')

    const checkLiquidity = async () => {
      const pairLiquidity = await wbnb.balanceOf(pair)

      if (pairLiquidity.lte(parseEther(String(MIN_LIQUIDITY)))) {
        await checkLiquidity()

        return
      }

      cli.action.stop()

      ctx.log(`Liquidity : ${Number(formatEther(pairLiquidity)).toFixed(4)} BNB`)
      ctx.log('Preparing for execute trade...')
    }

    await checkLiquidity()
  }

  await loadPair()

  const executeBuy = async () => {
    ctx.log('Executing buy order...')

    const amountOutMin = 0
    const gasPrice = 10

    ctx.log(`Amount in      : ${amountIn} BNB`)
    ctx.log(`Amount out min : `)
    ctx.log(`Slippage       : 100% `)
    ctx.log(`Gas price      : ${gasPrice} gwei`)

    const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      parseEther(String(amountIn)),
      amountOutMin,
      [WBNB_ADDRESS, targetAddress],
      wallet.address,
      Date.now() + 1000 * 60 * 5,
      {
        gasPrice: parseUnits(String(gasPrice), 9),
      }
    )

    const receipt = await tx.wait()
    cli.url(
      `Transaction receipt : https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`,
      `https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`
    )
  }

  if (!executeTrade) return

  await executeBuy()
}
