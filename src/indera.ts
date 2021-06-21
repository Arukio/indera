import { config } from 'dotenv'

config()

import Command from '@oclif/command'
import cli from 'cli-ux'
import { constants, Contract, providers, Wallet } from 'ethers'
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils'
import { FACTORY_ADDRESS, MIN_LIQUIDITY, ROUTER_ADDRESS, RPC_URL, WBNB_ADDRESS } from './constants'

import BEP20 from './abis/BEP20.json'
import PancakeFactory from './abis/PancakeFactory.json'
import PancakeRouter from './abis/PancakeRouter.json'

const provider = new providers.JsonRpcProvider(RPC_URL)
const wallet = new Wallet(process.env.PRIVATE_KEY as string, provider)

type BotParam = {
  ctx: Command
  targetAddress: string
  amountIn: number
  gasPrice: number
  executeTrade: boolean
}

export const executeBot = async ({ targetAddress, ctx, amountIn, executeTrade, gasPrice }: BotParam) => {
  const wbnb = new Contract(WBNB_ADDRESS, BEP20, wallet)
  //   const target = new Contract(targetAddress, BEP20, wallet)
  const router = new Contract(ROUTER_ADDRESS, PancakeRouter, wallet)
  const factory = new Contract(FACTORY_ADDRESS, PancakeFactory, wallet)

  cli.action.start('Fetching wallet Balance')
  const balance = await wbnb.balanceOf(wallet.address)
  cli.action.stop()

  ctx.log(`WBNB Balance : ${formatEther(balance)}`)

  if (balance.lt(parseEther(String(amountIn)))) {
    ctx.log('Balance is not enough for executing trade!')
  }

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
    }

    await checkLiquidity()
  }

  await loadPair()

  const executeBuy = async () => {
    ctx.log('Executing buy order...')

    const amountOutMin = 0
    const _gasPrice = parseUnits(String(gasPrice), 'gwei')

    ctx.log(`Amount in      : ${amountIn} BNB`)
    ctx.log(`Amount out min : ${amountOutMin}`)
    ctx.log(`Slippage       : 100% `)
    ctx.log(`Gas price      : ${gasPrice} gwei`)

    cli.action.start('Waiting transaction')

    const tx = await router
      .swapExactTokensForTokens(
        parseEther(String(amountIn)),
        amountOutMin,
        [WBNB_ADDRESS, targetAddress],
        wallet.address,
        Date.now() + 1000 * 60 * 5,
        {
          gasPrice: _gasPrice,
        }
      )
      .catch(async (error: Error) => {
        cli.action.stop()
        ctx.log(`ERROR : ${error.message}`)
        const retry = await cli.prompt('Retry execute?', { default: 'y' })

        if (retry === 'y') {
          await executeBuy()
        }
      })

    const receipt = await tx.wait()
    cli.action.stop()
    cli.log('Transaction success')
    cli.url(
      `Transaction receipt : https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`,
      `https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`
    )
  }

  if (!executeTrade) {
    return
  }

  ctx.log('Preparing for execute trade...')

  if (balance.lt(parseEther(String(amountIn)))) {
    ctx.log('Balance is not enough for executing trade!')
    return
  }

  await executeBuy()
}
