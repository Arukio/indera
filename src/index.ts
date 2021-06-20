import { Command } from '@oclif/command'
import cli from 'cli-ux'
import { executeBot } from './indera'

class Indera extends Command {
  private printHeader() {
    this.log('-'.repeat(20))
    this.log('INDERA DEGEN TOOLS')

    this.log('-'.repeat(20))
    this.log('TRADE SETUP')
  }

  async run() {
    this.printHeader()

    const amountIn = await cli.prompt('Enter buy amount', { required: true })
    const targetAddress = await cli.prompt('Enter Token Address ', { required: true })

    const executeTrade = await cli.prompt('Execute Trade Buy', { default: 'n' })

    await executeBot({ targetAddress, amountIn, executeTrade: executeTrade === 'y', ctx: this })

    await cli.anykey('Press any key to exit')
  }
}

export = Indera
