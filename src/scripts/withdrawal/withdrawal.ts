import { mnemonicToWalletKey } from '@ton/crypto'
import { Address, beginCell, internal, toNano, TonClient } from '@ton/ton'
import { configDotenv } from 'dotenv'

import { HighloadWalletContractV2 } from '../../highload/HighloadWalletV2'
import { loadAddress, loadString, makeQueryId } from '../../util'
;(async () => {
    configDotenv()

    const config = {
        mnemonic: loadString('HIGHLOAD_WALLET_MNEMONIC'),
        rpcEndpoint: loadString('TON_RPC_ENDPOINT'),
        rpcEndpointToken: loadString('TON_RPC_TOKEN'),
        recipientAddress: Address.parse(loadAddress('MY_WALLET_ADDRESS')), // Адрес получателя
        highloadWalletAddress: Address.parse(loadString('HIGHLOAD_WALLET_ADDRESS')),
        amount: '0.572', // Укажите количество USDT для вывода 0.001 === 1 USDT
    }

    const tonClient = new TonClient({
        endpoint: config.rpcEndpoint,
        apiKey: config.rpcEndpointToken,
    })

    const keypair = await mnemonicToWalletKey(config.mnemonic.split(' '))
    const contract = tonClient.open(HighloadWalletContractV2.create({ publicKey: keypair.publicKey, workchain: 0 }))

    console.log(
        'Wallet address:',
        contract.address.toString({
            testOnly: process.env.IS_TESTNET === 'true',
        })
    )

    // Адрес контракта USDT (замените на реальный адрес контракта)
    const usdtContractAddress = Address.parse(loadAddress('MY_WALLET_USDT_ADDRESS'))

    // TODO: подумать над оптимизацией комиссий

    // Создаем payload для вызова смарт-контракта
    const transferPayload = beginCell()
        .storeUint(0xf8a7ea5, 32) // jetton transfer op code
        .storeUint(makeQueryId(), 64) // query_id:uint64
        .storeCoins(toNano(config.amount)) // amount (VarUInteger 16), 100 USDT (с учётом 6 десятичных знаков)
        .storeAddress(config.recipientAddress) // destination:MsgAddress
        .storeAddress(usdtContractAddress) // response_destination:MsgAddress
        .storeUint(0, 1) // custom_payload:(Maybe ^Cell)
        .storeCoins(toNano('0.04')) // forward_ton_amount:(VarUInteger 16), комиссия для уведомления
        .storeUint(0, 1) // forward_payload:(Either Cell ^Cell)
        .endCell()

    // Send transfer
    await contract.sendTransfer({
        secretKey: keypair.secretKey,
        messages: [
            internal({
                to: usdtContractAddress,
                value: toNano('0.05'),
                body: transferPayload,
                bounce: true,
            }),
        ],
    })

    console.log('Transfer initiated...')
})()
