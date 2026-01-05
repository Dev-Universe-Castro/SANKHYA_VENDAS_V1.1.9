"use client"

import { useState, useEffect } from "react"
import { Plus, Package, TrendingUp, RefreshCw, ShoppingCart, Sparkles, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

interface MixProdutosIAProps {
  codParc: string | number
  nomeParceiro?: string
  onAdicionarItem: (produto: any, quantidade: number, desconto?: number) => void
  itensCarrinho: any[]
}

export function MixProdutosIA({
  codParc,
  nomeParceiro,
  onAdicionarItem,
  itensCarrinho = []
}: MixProdutosIAProps) {
  const [loading, setLoading] = useState(false)
  const [sugestoes, setSugestoes] = useState<any[]>([])
  const [resumo, setResumo] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [produtoImagens, setProdutoImagens] = useState<{ [key: string]: string | null }>({})

  useEffect(() => {
    if (codParc && codParc !== "0" && codParc !== "") {
      buscarMixProdutos()
    }
  }, [codParc])

  const buscarMixProdutos = async () => {
    if (!codParc || codParc === "0") {
      setErro("Selecione um parceiro para ver as sugestões de produtos")
      return
    }

    setLoading(true)
    setErro(null)

    try {
      const response = await fetch('/api/mix-produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codParc, meses: 3 })
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar mix de produtos')
      }

      const data = await response.json()
      setSugestoes(data.sugestoes || [])
      setResumo(data.resumo || null)

      if (data.sugestoes?.length > 0) {
        data.sugestoes.slice(0, 8).forEach((s: any) => {
          buscarImagemProduto(s.CODPROD)
        })
      }

    } catch (error: any) {
      console.error('[MIX-IA] Erro:', error)
      setErro(error.message || 'Erro ao buscar sugestões')
    } finally {
      setLoading(false)
    }
  }

  const buscarImagemProduto = async (codProd: string | number) => {
    if (produtoImagens[codProd] !== undefined) return

    try {
      const response = await fetch(`/api/sankhya/produtos/imagem?codProd=${codProd}`)
      if (response.ok) {
        const blob = await response.blob()
        const imageUrl = URL.createObjectURL(blob)
        setProdutoImagens(prev => ({ ...prev, [codProd]: imageUrl }))
      } else {
        setProdutoImagens(prev => ({ ...prev, [codProd]: null }))
      }
    } catch {
      setProdutoImagens(prev => ({ ...prev, [codProd]: null }))
    }
  }

  const adicionarProduto = (produto: any) => {
    const jaNoCarrinho = itensCarrinho.some(item => String(item.CODPROD) === String(produto.CODPROD))
    
    if (jaNoCarrinho) {
      toast.warning("Produto já está no carrinho", {
        description: produto.DESCRPROD
      })
      return
    }

    onAdicionarItem({
      CODPROD: produto.CODPROD,
      DESCRPROD: produto.DESCRPROD,
      CODVOL: produto.CODVOL || 'UN',
      UNIDADE: produto.UNIDADE || 'UN',
      VLRUNIT: produto.valorTotal / produto.qtdComprada,
      preco: produto.valorTotal / produto.qtdComprada
    }, produto.sugestaoQtd || 1, 0)

    toast.success("Produto adicionado ao carrinho", {
      description: `${produto.DESCRPROD} - ${produto.sugestaoQtd || 1} un`
    })
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  if (!codParc || codParc === "0") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700">Parceiro não selecionado</h3>
        <p className="text-sm text-gray-500 mt-2">
          Selecione um parceiro na aba "Cabeçalho" para ver as sugestões de produtos baseadas no histórico de compras.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              <CardTitle className="text-base text-green-800">IA Mix de Produtos</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={buscarMixProdutos}
              disabled={loading}
              className="border-green-300 text-green-700 hover:bg-green-100"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-green-700">
            Sugestões baseadas nas compras de <strong>{nomeParceiro || `Parceiro ${codParc}`}</strong> nos últimos 3 meses.
          </p>
          {resumo && (
            <div className="flex gap-4 mt-2 text-xs text-green-600">
              <span>{resumo.totalNotas} notas</span>
              <span>{resumo.produtosUnicos} produtos</span>
              <span>{resumo.periodo}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-500">Analisando histórico de compras...</p>
        </div>
      ) : erro ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-sm text-red-600">{erro}</p>
          <Button variant="outline" size="sm" onClick={buscarMixProdutos} className="mt-3">
            Tentar novamente
          </Button>
        </div>
      ) : sugestoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Package className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">Nenhum histórico de compras encontrado</p>
          <p className="text-xs text-gray-400 mt-1">Este cliente não possui compras nos últimos 3 meses</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1">
            {sugestoes.map((produto) => {
              const jaNoCarrinho = itensCarrinho.some(item => String(item.CODPROD) === String(produto.CODPROD))
              const imagemUrl = produtoImagens[produto.CODPROD]

              return (
                <Card 
                  key={produto.CODPROD} 
                  className={`relative overflow-hidden transition-all ${jaNoCarrinho ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:shadow-md'}`}
                >
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {imagemUrl ? (
                          <img 
                            src={imagemUrl} 
                            alt={produto.DESCRPROD} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">
                          {produto.DESCRPROD}
                        </h4>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {produto.qtdComprada} un
                          </Badge>
                          <span className="text-[10px] text-gray-500">
                            {produto.vezes}x comprado
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-green-600" />
                            <span className="text-xs font-semibold text-green-700">
                              {formatarMoeda(produto.valorTotal)}
                            </span>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => adicionarProduto(produto)}
                            disabled={jaNoCarrinho}
                            className={`h-7 px-2 text-xs ${jaNoCarrinho ? 'bg-green-600' : 'bg-green-600 hover:bg-green-700'}`}
                          >
                            {jaNoCarrinho ? (
                              <>
                                <ShoppingCart className="w-3 h-3 mr-1" />
                                No carrinho
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 mr-1" />
                                +{produto.sugestaoQtd || 1}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
