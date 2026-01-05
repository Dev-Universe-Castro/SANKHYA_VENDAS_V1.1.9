"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, Filter, ShoppingCart, Plus, Minus, ChevronRight, DollarSign, Percent, Package, Boxes, Grid3x3, List, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OfflineDataService } from "@/lib/offline-data-service"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ProdutoDetalhesModal } from "@/components/produto-detalhes-modal"

interface CatalogoProdutosPedidoProps {
  onAdicionarItem: (produto: any, quantidade: number, desconto?: number) => void
  tabelaPreco?: string
  itensCarrinho: any[]
  onAbrirCarrinho?: () => void // Adicionado para clareza, se for usado
}

export function CatalogoProdutosPedido({
  onAdicionarItem,
  tabelaPreco,
  itensCarrinho = [],
  onAbrirCarrinho
}: CatalogoProdutosPedidoProps) {
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState("")
  const [buscaAplicada, setBuscaAplicada] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("TODAS")
  const [categorias, setCategorias] = useState<string[]>([])
  const [quantidades, setQuantidades] = useState<{ [key: string]: number }>({})
  const [descontos, setDescontos] = useState<{ [key: string]: number }>({})
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [produtoPrecos, setProdutoPrecos] = useState<any>(null)
  const [showPrecosModal, setShowPrecosModal] = useState(false)
  const [showCarrinhoModal, setShowCarrinhoModal] = useState(false)
  const [showUnidadesModal, setShowUnidadesModal] = useState(false)
  const [produtoUnidades, setProdutoUnidades] = useState<any>(null)
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<{ [key: string]: string }>({})
  const [produtoDetalhes, setProdutoDetalhes] = useState<any>(null)
  const [showDetalhesModal, setShowDetalhesModal] = useState(false)
  const [produtoSelecionadoConfig, setProdutoSelecionadoConfig] = useState<any>(null)
  const [showConfigProdutoModal, setShowConfigProdutoModal] = useState(false)
  const [configProduto, setConfigProduto] = useState({
    quantidade: 1,
    desconto: 0,
    unidade: '',
    preco: 0
  })
  const [modoVisualizacao, setModoVisualizacao] = useState<'grid' | 'tabela'>('grid')
  const ITENS_POR_PAGINA = 12

  // Estado para gerenciar o carregamento e URL das imagens
  const [produtoImagens, setProdutoImagens] = useState<{ [key: string]: { url: string | null, loading: boolean, loaded: boolean } }>({})

  useEffect(() => {
    carregarProdutos()
  }, [tabelaPreco])

  const buscarImagemProduto = async (codProd: string) => {
    // Retorna imediatamente se a imagem já foi carregada ou está em carregamento
    if (produtoImagens[codProd]?.loaded || produtoImagens[codProd]?.loading) {
      return produtoImagens[codProd]?.url
    }

    // Apenas buscar se estiver online
    if (!navigator.onLine) {
      setProdutoImagens(prev => ({
        ...prev,
        [codProd]: { url: null, loading: false, loaded: true }
      }))
      return null
    }

    // Marca como carregando
    setProdutoImagens(prev => ({
      ...prev,
      [codProd]: { url: null, loading: true, loaded: false }
    }))

    try {
      const response = await fetch(`/api/sankhya/produtos/imagem?codProd=${codProd}`)

      if (!response.ok) {
        console.warn(`Imagem não encontrada para produto ${codProd}`)
        setProdutoImagens(prev => ({
          ...prev,
          [codProd]: { url: null, loading: false, loaded: true }
        }))
        return null
      }

      const blob = await response.blob()
      const imageUrl = URL.createObjectURL(blob)

      // Armazena a URL da imagem e marca como carregada
      setProdutoImagens(prev => ({
        ...prev,
        [codProd]: { url: imageUrl, loading: false, loaded: true }
      }))

      return imageUrl
    } catch (error) {
      console.error(`Erro ao buscar imagem do produto ${codProd}:`, error)
      setProdutoImagens(prev => ({
        ...prev,
        [codProd]: { url: null, loading: false, loaded: true }
      }))
      return null
    }
  }

  const carregarProdutos = async () => {
    setLoading(true)
    try {
      const produtosData = await OfflineDataService.getProdutos()

      const produtosComDados = produtosData.map((produto: any) => ({
        ...produto,
        preco: parseFloat(produto.AD_VLRUNIT || 0)
      }))

      setProdutos(produtosComDados)

      const categoriasUnicas = [...new Set(
        produtosComDados
          .map(p => p.MARCA || 'SEM MARCA')
          .filter(Boolean)
      )] as string[]

      setCategorias(['TODAS', ...categoriasUnicas.sort()])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  const normalizarTexto = (texto: string) => {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  const produtosFiltrados = useMemo(() => {
    const filtrados = produtos.filter(produto => {
      const buscaNormalizada = normalizarTexto(buscaAplicada)
      const descricaoNormalizada = normalizarTexto(produto.DESCRPROD || '')

      const matchBusca = buscaAplicada === "" ||
        descricaoNormalizada.includes(buscaNormalizada) ||
        produto.CODPROD?.toString().includes(buscaAplicada)

      const matchCategoria = categoriaFiltro === "TODAS" ||
        (produto.MARCA || 'SEM MARCA') === categoriaFiltro

      return matchBusca && matchCategoria
    })

    return filtrados
  }, [produtos, buscaAplicada, categoriaFiltro])

  const totalPaginas = Math.ceil(produtosFiltrados.length / ITENS_POR_PAGINA)

  const produtosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    const fim = inicio + ITENS_POR_PAGINA
    const pagina = produtosFiltrados.slice(inicio, fim)
    console.log(`📄 Página ${paginaAtual}: mostrando ${pagina.length} produtos (${inicio + 1} a ${Math.min(fim, produtosFiltrados.length)} de ${produtosFiltrados.length})`)
    return pagina
  }, [produtosFiltrados, paginaAtual])

  useEffect(() => {
    setPaginaAtual(1)
  }, [busca, categoriaFiltro])

  // Função para carregar a imagem de um produto específico sob demanda
  const carregarImagemProdutoUnica = (codProd: string) => {
    if (!produtoImagens[codProd]?.url && !produtoImagens[codProd]?.loading) {
      buscarImagemProduto(codProd)
    }
  }

  const getQuantidadeCarrinho = (codProd: string) => {
    const itemCarrinho = itensCarrinho.find(item =>
      String(item.CODPROD) === String(codProd)
    )
    return itemCarrinho?.QTDNEG || 0
  }

  const handleQuantidadeChange = (codProd: string, delta: number) => {
    setQuantidades(prev => {
      const atual = prev[codProd] || 0
      const novo = Math.max(0, atual + delta)
      return { ...prev, [codProd]: novo }
    })
  }

  const handleAdicionarAoCarrinho = (produto: any) => {
    if (!tabelaPreco || tabelaPreco === '') {
      toast.error('Selecione uma tabela de preço no pedido', {
        description: 'Escolha uma tabela de preço antes de adicionar produtos'
      })
      return
    }

    if (!unidadesSelecionadas[produto.CODPROD]) {
      toast.error('Selecione uma unidade antes de adicionar ao carrinho', {
        description: 'Clique no botão "Unidades" para escolher uma unidade'
      })
      return
    }

    const quantidade = quantidades[produto.CODPROD] || 1
    const desconto = descontos[produto.CODPROD] || 0
    const precoCustomizado = quantidades[produto.CODPROD + '_preco'] || produto.preco
    const unidadeSelecionada = unidadesSelecionadas[produto.CODPROD]
    const unidadeInfo = produtoUnidades?.unidades?.find((u: any) => u.CODVOL === unidadeSelecionada);
    const fatorUnidade = unidadeInfo ? unidadeInfo.QUANTIDADE : 1;

    const vlrUnitario = precoCustomizado;
    const vlrSubtotal = vlrUnitario * quantidade
    const vlrDesconto = (vlrSubtotal * desconto) / 100
    const vlrTotal = vlrSubtotal - vlrDesconto

    console.log('🛒 Adicionando ao carrinho:', {
      produto: produto.DESCRPROD,
      CODVOL: unidadeSelecionada,
      fatorUnidade,
      operacao: fatorUnidade > 1 ? 'multiplicação' : fatorUnidade < 1 ? 'divisão' : 'mantido',
      vlrUnitario,
      quantidade,
      desconto,
      vlrSubtotal,
      vlrDesconto,
      vlrTotal
    })

    const produtoComPreco = {
      ...produto,
      CODVOL: unidadeSelecionada,
      preco: vlrUnitario,
      VLRUNIT: vlrUnitario,
      VLRTOT: vlrTotal,
      VLRDESC: vlrDesconto,
      PERCDESC: desconto,
      FATOR_UNIDADE: fatorUnidade
    }

    onAdicionarItem(produtoComPreco, quantidade, desconto)
    setQuantidades(prev => {
      const newState = { ...prev }
      delete newState[produto.CODPROD]
      delete newState[produto.CODPROD + '_preco']
      return newState
    })
    setDescontos(prev => {
      const newState = { ...prev }
      delete newState[produto.CODPROD]
      return newState
    })
    toast.success(`${produto.DESCRPROD} adicionado ao carrinho (${desconto > 0 ? formatCurrency(vlrTotal) : formatCurrency(vlrSubtotal)})`)
  }

  const handleVerUnidades = async (produto: any) => {
    try {
      const volumes = await OfflineDataService.getVolumes(produto.CODPROD)
      console.log('🔍 Volumes alternativos encontrados:', volumes)

      const unidades = [
        {
          CODVOL: produto.UNIDADE || 'UN',
          DESCRICAO: `${produto.UNIDADE || 'UN'} - Unidade Padrão`,
          QUANTIDADE: 1,
          isPadrao: true
        },
        ...volumes.filter((v: any) => v.ATIVO === 'S').map((v: any) => ({
          CODVOL: v.CODVOL,
          DESCRICAO: v.DESCRDANFE || v.CODVOL,
          QUANTIDADE: v.QUANTIDADE || 1,
          isPadrao: false,
          ...v
        }))
      ]

      setProdutoUnidades({ produto, unidades })
      setShowUnidadesModal(true)
    } catch (error) {
      console.error('❌ Erro ao buscar unidades:', error)
      toast.error('Erro ao buscar unidades alternativas')
    }
  }

  const handleVerPrecos = async (produto: any) => {
    try {
      const tabelasPrecos = await OfflineDataService.getTabelasPrecosConfig()

      const precosPromises = tabelasPrecos.map(async (tabela: any) => {
        const codProdNumber = Number(produto.CODPROD)
        const nutabNumber = Number(tabela.NUTAB)

        const precos = await OfflineDataService.getPrecos(codProdNumber, nutabNumber)

        let preco = 0
        if (precos.length > 0) {
          const primeiraExcecao = precos[0]

          if (primeiraExcecao.VLRVENDA !== null && primeiraExcecao.VLRVENDA !== undefined) {
            let vlrVendaStr = String(primeiraExcecao.VLRVENDA).trim()
            vlrVendaStr = vlrVendaStr.replace(/,/g, '.').replace(/\s/g, '')

            preco = parseFloat(vlrVendaStr)

            if (isNaN(preco) || preco < 0) {
              preco = 0
            }
          }
        }

        return {
          tabela: tabela.DESCRICAO || tabela.CODTAB || `Tabela ${tabela.NUTAB}`,
          nutab: nutabNumber,
          codtab: tabela.CODTAB,
          preco: preco
        }
      })

      const precosData = await Promise.all(precosPromises)
      setProdutoPrecos({ produto, precos: precosData })
      setShowPrecosModal(true)
    } catch (error) {
      console.error('❌ Erro ao buscar preços:', error)
      toast.error('Erro ao buscar preços')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const calcularPrecoComUnidade = (produto: any, unidade: any, precoBase?: number) => {
    const preco = precoBase || produto.preco;
    let precoAjustado;
    let mensagemCalculo = '';

    if (unidade.isPadrao) {
      precoAjustado = preco;
      mensagemCalculo = 'Preço padrão mantido';
    } else {
      if (unidade.QUANTIDADE > 1) {
        precoAjustado = preco * unidade.QUANTIDADE;
        mensagemCalculo = `Preço × ${unidade.QUANTIDADE}`;
      } else if (unidade.QUANTIDADE < 1) {
        precoAjustado = preco * unidade.QUANTIDADE;
        const divisor = Math.round(1 / unidade.QUANTIDADE);
        mensagemCalculo = `Preço ÷ ${divisor}`;
      } else {
        precoAjustado = preco;
        mensagemCalculo = 'Preço mantido';
      }
    }

    return { precoAjustado, mensagemCalculo };
  }

  const handleVerDetalhes = (produto: any) => {
    setProdutoDetalhes(produto)
    setShowDetalhesModal(true)
  }

  const handleSelecionarUnidade = (produto: any, unidade: any) => {
    setUnidadesSelecionadas(prev => ({
      ...prev,
      [produto.CODPROD]: unidade.CODVOL
    }))

    const { precoAjustado, mensagemCalculo } = calcularPrecoComUnidade(produto, unidade);

    console.log('💰 Ajuste de preço por unidade:', {
      produto: produto.DESCRPROD,
      unidade: unidade.CODVOL,
      isPadrao: unidade.isPadrao,
      quantidade: unidade.QUANTIDADE,
      precoBase: produto.preco,
      precoAjustado,
      operacao: unidade.QUANTIDADE > 1 ? 'multiplicação' : unidade.QUANTIDADE < 1 ? 'divisão' : 'mantido'
    })

    toast.success(`${unidade.CODVOL} selecionada`, {
      description: mensagemCalculo
    })

    setQuantidades(prev => ({
      ...prev,
      [produto.CODPROD + '_preco']: precoAjustado
    }))

    setShowUnidadesModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="ml-3 text-sm font-medium text-green-600">Carregando produtos...</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Loading Unificado - Mais Visível */}
        {(!Object.values(produtoImagens).every(img => img.loaded) || loading) && produtosPaginados.length > 0 && (
          <div className="sticky top-0 z-10 bg-green-50 border border-green-200 rounded-lg p-3 shadow-md">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-green-700">
                {loading ? 'Carregando produtos...' : 'Carregando imagens...'}
              </p>
            </div>
          </div>
        )}

        {/* Cabeçalho com Busca e Modo de Visualização */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  setBuscaAplicada(busca)
                  setPaginaAtual(1)
                }
              }}
              className="pl-10"
            />
          </div>

          {/* Botões de Modo de Visualização - Apenas Desktop */}
          <div className="hidden md:flex gap-1 border rounded-md p-1">
            <Button
              variant={modoVisualizacao === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setModoVisualizacao('grid')}
              className={modoVisualizacao === 'grid' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={modoVisualizacao === 'tabela' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setModoVisualizacao('tabela')}
              className={modoVisualizacao === 'tabela' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="default"
            size="default"
            onClick={() => {
              setBuscaAplicada(busca)
              setPaginaAtual(1)
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            <Search className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtrar</span>
          </Button>
        </div>

        {/* Filtros Rápidos - Estilo Stories */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {categorias.map((categoria) => (
              <Button
                key={categoria}
                variant={categoriaFiltro === categoria ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoriaFiltro(categoria)}
                className={`
                  rounded-full px-4 flex-shrink-0 transition-all
                  ${categoriaFiltro === categoria
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg scale-105'
                    : 'hover:scale-105'
                  }
                `}
              >
                {categoria}
              </Button>
            ))}
          </div>
        </ScrollArea>

        {/* Modo Tabela - Apenas Desktop */}
        {modoVisualizacao === 'tabela' && (
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[80px] text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosPaginados.map((produto) => {
                  const qtdCarrinho = getQuantidadeCarrinho(produto.CODPROD)

                  return (
                    <TableRow key={produto.CODPROD}>
                      <TableCell className="font-mono text-xs">
                        {produto.CODPROD}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm line-clamp-2">
                            {produto.DESCRPROD}
                          </span>
                          {qtdCarrinho > 0 && (
                            <span className="text-xs text-green-600">
                              {qtdCarrinho} no carrinho
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            setProdutoSelecionadoConfig(produto)
                            setShowConfigProdutoModal(true)
                          }}
                          className="bg-green-600 hover:bg-green-700 h-8 w-8 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {produtosFiltrados.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            )}
          </div>
        )}

        {/* Grade de Produtos - Desktop */}
        {modoVisualizacao === 'grid' && (
          <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {produtosPaginados.map((produto) => {
              const qtdCarrinho = getQuantidadeCarrinho(produto.CODPROD)

              return (
                <Card key={produto.CODPROD} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="relative">
                    <div
                      className="w-full h-32 bg-white border-b flex items-center justify-center overflow-hidden relative cursor-pointer"
                    >
                      {produtoImagens[produto.CODPROD]?.loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white">
                          <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : produtoImagens[produto.CODPROD]?.url ? (
                        <img
                          src={produtoImagens[produto.CODPROD].url}
                          alt={produto.DESCRPROD}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = 'none'
                            // Marca como erro para não tentar carregar de novo
                            setProdutoImagens(prev => ({
                              ...prev,
                              [produto.CODPROD]: { url: null, loading: false, loaded: true }
                            }))
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center bg-white w-full h-full">
                          <div className="text-6xl text-gray-300 font-bold">
                            {produto.DESCRPROD?.charAt(0).toUpperCase() || 'P'}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">Sem imagem</div>
                        </div>
                      )}
                    </div>

                    {/* Botão "Abrir Imagem" */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white hover:bg-black/70 backdrop-blur-sm rounded-full h-8 px-3"
                      onClick={() => {
                        carregarImagemProdutoUnica(produto.CODPROD)
                        handleVerDetalhes(produto)
                      }}
                      disabled={produtoImagens[produto.CODPROD]?.loading}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      <span className="text-xs">Abrir</span>
                    </Button>
                  </div>

                  <CardContent className="p-3 space-y-2">
                    <div>
                      <h3 className="font-semibold text-xs line-clamp-2 min-h-[2rem]">
                        {produto.DESCRPROD}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Cód: {produto.CODPROD}
                      </p>
                    </div>

                    <Button
                      size="icon"
                      onClick={() => {
                        setProdutoSelecionadoConfig(produto)
                        setShowConfigProdutoModal(true)
                      }}
                      className="w-full h-10 rounded-full bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>

                    {qtdCarrinho > 0 && (
                      <div className="text-[10px] text-center text-green-600 font-medium">
                        {qtdCarrinho} no carrinho
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Lista de Produtos - Mobile */}
        {modoVisualizacao === 'grid' && (
          <div className="md:hidden space-y-2 pb-4">
            {produtosPaginados.map((produto) => {
              const qtdCarrinho = getQuantidadeCarrinho(produto.CODPROD)

              return (
                <div key={produto.CODPROD} className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex gap-3">
                    {/* Imagem */}
                    <div
                      className="w-12 h-12 bg-gray-50 border rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer relative"
                    >
                      {produtoImagens[produto.CODPROD]?.loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white">
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : produtoImagens[produto.CODPROD]?.url ? (
                        <img
                          src={produtoImagens[produto.CODPROD].url}
                          alt={produto.DESCRPROD}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = 'none'
                            setProdutoImagens(prev => ({
                              ...prev,
                              [produto.CODPROD]: { url: null, loading: false, loaded: true }
                            }))
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center bg-white w-full h-full">
                          <div className="text-2xl text-gray-300 font-bold">
                            {produto.DESCRPROD?.charAt(0).toUpperCase() || 'P'}
                          </div>
                          <div className="text-[8px] text-gray-400 mt-0.5">Sem imagem</div>
                        </div>
                      )}
                    </div>

                    {/* Botão "Abrir Imagem" */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1.5 right-1.5 bg-black bg-opacity-50 text-white hover:bg-black/70 backdrop-blur-sm rounded-full h-7 px-2"
                      onClick={() => {
                        carregarImagemProdutoUnica(produto.CODPROD)
                        handleVerDetalhes(produto)
                      }}
                      disabled={produtoImagens[produto.CODPROD]?.loading}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      <span className="text-[9px]">Abrir</span>
                    </Button>

                    {/* Informações do Produto */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-[10px] text-green-600 font-medium">Ativo</span>
                      </div>

                      <div
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                        onClick={() => handleVerDetalhes(produto)}
                      >
                        <h3 className="font-semibold text-sm line-clamp-2 mb-0.5">
                          {produto.DESCRPROD}
                        </h3>

                        <p className="text-xs text-muted-foreground">
                          Cód: {produto.CODPROD}
                        </p>
                      </div>

                      {qtdCarrinho > 0 && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            {qtdCarrinho} no carrinho
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Botão de Adicionar */}
                    <Button
                      size="icon"
                      onClick={() => {
                        setProdutoSelecionadoConfig(produto)
                        setShowConfigProdutoModal(true)
                      }}
                      className="h-10 w-10 rounded-full bg-green-600 hover:bg-green-700 flex-shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {produtosFiltrados.length === 0 && modoVisualizacao === 'grid' && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum produto encontrado
          </div>
        )}

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
              disabled={paginaAtual === 1}
            >
              Anterior
            </Button>
            <span className="text-sm">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
              disabled={paginaAtual === totalPaginas}
            >
              Próxima
            </Button>
          </div>
        )}

        {/* Modal de Preços */}
        <Dialog open={showPrecosModal} onOpenChange={setShowPrecosModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Escolher Preço de Tabela</DialogTitle>
            </DialogHeader>
            {produtoPrecos && (
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">{produtoPrecos.produto.DESCRPROD}</p>
                  <p className="text-sm text-muted-foreground">Cód: {produtoPrecos.produto.CODPROD}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tabela</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtoPrecos.precos.map((preco: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{preco.tabela}</span>
                            <span className="text-xs text-muted-foreground">
                              NUTAB: {preco.nutab} | CODTAB: {preco.codtab}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {preco.preco > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-semibold text-green-600">
                                {formatCurrency(preco.preco)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sem preço</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={preco.preco > 0 ? "default" : "outline"}
                            onClick={() => {
                              if (preco.preco > 0) {
                                const produto = produtoPrecos.produto;
                                const unidadeSelecionada = unidadesSelecionadas[produto.CODPROD];

                                if (unidadeSelecionada && produtoUnidades?.unidades) {
                                  const unidadeInfo = produtoUnidades.unidades.find((u: any) => u.CODVOL === unidadeSelecionada);
                                  if (unidadeInfo) {
                                    const { precoAjustado } = calcularPrecoComUnidade(
                                      { ...produto, preco: preco.preco },
                                      unidadeInfo,
                                      preco.preco
                                    );
                                    setQuantidades(prev => ({
                                      ...prev,
                                      [produto.CODPROD + '_preco']: precoAjustado
                                    }))
                                    toast.success(`Preço de ${preco.tabela} aplicado com unidade ${unidadeSelecionada}`, {
                                      description: formatCurrency(precoAjustado)
                                    })
                                  } else {
                                    setQuantidades(prev => ({
                                      ...prev,
                                      [produto.CODPROD + '_preco']: preco.preco
                                    }))
                                    toast.success(`Preço de ${preco.tabela} aplicado: ${formatCurrency(preco.preco)}`)
                                  }
                                } else {
                                  setQuantidades(prev => ({
                                    ...prev,
                                    [produto.CODPROD + '_preco']: preco.preco
                                  }))
                                  toast.success(`Preço de ${preco.tabela} aplicado: ${formatCurrency(preco.preco)}`)
                                }
                                setShowPrecosModal(false)
                              } else {
                                toast.warning('Esta tabela não possui preço cadastrado para este produto')
                              }
                            }}
                            disabled={preco.preco <= 0}
                            className="w-full"
                          >
                            {preco.preco > 0 ? 'Aplicar' : 'Sem Preço'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Detalhes do Produto */}
        <ProdutoDetalhesModal
          produto={produtoDetalhes}
          isOpen={showDetalhesModal}
          onClose={() => setShowDetalhesModal(false)}
        />

        {/* Modal de Unidades Alternativas */}
        <Dialog open={showUnidadesModal} onOpenChange={setShowUnidadesModal}>
          <DialogContent className="max-w-lg md:max-h-[80vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-green-600" />
                Unidades Disponíveis
              </DialogTitle>
            </DialogHeader>
            {produtoUnidades && (
              <div className="flex flex-col gap-3 md:min-h-0">
                <div className="flex-shrink-0">
                  <p className="font-semibold text-sm">{produtoUnidades.produto.DESCRPROD}</p>
                  <p className="text-xs text-muted-foreground">Cód: {produtoUnidades.produto.CODPROD}</p>
                </div>
                <div className="md:hidden space-y-2">
                  {produtoUnidades.unidades.map((unidade: any, index: number) => (
                    <Card key={index} className="border-green-100">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{unidade.CODVOL}</span>
                              {unidade.isPadrao && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  Padrão
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {unidade.DESCRICAO}
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              Qtd: <span className="font-semibold">{unidade.QUANTIDADE}</span>
                              {unidade.QUANTIDADE > 1 && (
                                <span className="text-xs text-orange-600 ml-2">
                                  (Preço será ajustado)
                                </span>
                              )}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSelecionarUnidade(produtoUnidades.produto, unidade)}
                            className="bg-green-600 hover:bg-green-700 flex-shrink-0 h-8"
                          >
                            Selecionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollArea className="hidden md:flex flex-1 -mx-6 px-6">
                  <div className="space-y-2 pr-4">
                    {produtoUnidades.unidades.map((unidade: any, index: number) => (
                      <Card key={index} className="border-green-100">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{unidade.CODVOL}</span>
                                {unidade.isPadrao && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Padrão
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {unidade.DESCRICAO}
                              </p>
                              <p className="text-xs text-green-600 mt-1">
                                Qtd: <span className="font-semibold">{unidade.QUANTIDADE}</span>
                                {unidade.QUANTIDADE > 1 && (
                                  <span className="text-xs text-orange-600 ml-2">
                                    (Preço será ajustado)
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleSelecionarUnidade(produtoUnidades.produto, unidade)}
                              className="bg-green-600 hover:bg-green-700 flex-shrink-0 h-8"
                            >
                              Selecionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Configuração do Produto - Mobile */}
        <Dialog open={showConfigProdutoModal} onOpenChange={setShowConfigProdutoModal}>
          <DialogContent className="max-w-md w-full p-0">
            {produtoSelecionadoConfig && (
              <div className="flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 border-b bg-green-600 text-white">
                  <h2 className="font-semibold text-lg">{produtoSelecionadoConfig.DESCRPROD}</h2>
                  <p className="text-sm text-green-50">Cód: {produtoSelecionadoConfig.CODPROD}</p>
                </div>

                {/* Body */}
                <div className="flex-1 p-4 md:overflow-y-auto">
                  <div className="space-y-4">
                    {/* Selecionar Unidade */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Unidade</Label>
                      <Button
                        variant="outline"
                        className="w-full justify-between h-11"
                        onClick={async () => {
                          try {
                            const volumes = await OfflineDataService.getVolumes(produtoSelecionadoConfig.CODPROD)
                            const unidades = [
                              {
                                CODVOL: produtoSelecionadoConfig.UNIDADE || 'UN',
                                DESCRICAO: `${produtoSelecionadoConfig.UNIDADE || 'UN'} - Unidade Padrão`,
                                QUANTIDADE: 1,
                                isPadrao: true
                              },
                              ...volumes.filter((v: any) => v.ATIVO === 'S').map((v: any) => ({
                                CODVOL: v.CODVOL,
                                DESCRICAO: v.DESCRDANFE || v.CODVOL,
                                QUANTIDADE: v.QUANTIDADE || 1,
                                isPadrao: false,
                                ...v
                              }))
                            ]
                            setProdutoUnidades({ produto: produtoSelecionadoConfig, unidades })
                            setShowUnidadesModal(true)
                          } catch (error) {
                            toast.error('Erro ao buscar unidades')
                          }
                        }}
                      >
                        <span>{configProduto.unidade || unidadesSelecionadas[produtoSelecionadoConfig.CODPROD] || 'Selecione uma unidade'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Selecionar Preço */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tabela de Preço</Label>
                      <Button
                        variant="outline"
                        className="w-full justify-between h-11"
                        onClick={() => handleVerPrecos(produtoSelecionadoConfig)}
                      >
                        <span>
                          {quantidades[produtoSelecionadoConfig.CODPROD + '_preco']
                            ? formatCurrency(quantidades[produtoSelecionadoConfig.CODPROD + '_preco'])
                            : formatCurrency(produtoSelecionadoConfig.preco)}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Quantidade */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Quantidade</Label>
                      <div className="flex items-center border rounded-lg overflow-hidden h-11">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const qtd = quantidades[produtoSelecionadoConfig.CODPROD] || 1
                            if (qtd > 1) {
                              setQuantidades(prev => ({ ...prev, [produtoSelecionadoConfig.CODPROD]: qtd - 1 }))
                            }
                          }}
                          className="h-full w-12 rounded-none"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <div className="flex-1 text-center font-semibold">
                          {quantidades[produtoSelecionadoConfig.CODPROD] || 1}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const qtd = quantidades[produtoSelecionadoConfig.CODPROD] || 1
                            setQuantidades(prev => ({ ...prev, [produtoSelecionadoConfig.CODPROD]: qtd + 1 }))
                          }}
                          className="h-full w-12 rounded-none"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Desconto */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Desconto (%)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={descontos[produtoSelecionadoConfig.CODPROD] || 0}
                          onChange={(e) => setDescontos(prev => ({
                            ...prev,
                            [produtoSelecionadoConfig.CODPROD]: parseFloat(e.target.value) || 0
                          }))}
                          className="h-11"
                          placeholder="0.00"
                        />
                        <Percent className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Resumo dos Valores */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor Unitário:</span>
                        <span className="font-semibold">
                          {formatCurrency(quantidades[produtoSelecionadoConfig.CODPROD + '_preco'] || produtoSelecionadoConfig.preco)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quantidade:</span>
                        <span className="font-semibold">{quantidades[produtoSelecionadoConfig.CODPROD] || 1}</span>
                      </div>
                      {descontos[produtoSelecionadoConfig.CODPROD] > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Desconto:</span>
                          <span className="font-semibold text-red-600">
                            -{descontos[produtoSelecionadoConfig.CODPROD]}%
                          </span>
                        </div>
                      )}
                      <div className="h-px bg-gray-200 my-2"></div>
                      <div className="flex justify-between text-base">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold text-green-600 text-lg">
                          {(() => {
                            const preco = quantidades[produtoSelecionadoConfig.CODPROD + '_preco'] || produtoSelecionadoConfig.preco
                            const qtd = quantidades[produtoSelecionadoConfig.CODPROD] || 1
                            const desc = descontos[produtoSelecionadoConfig.CODPROD] || 0
                            const subtotal = preco * qtd
                            const total = subtotal * (1 - desc / 100)
                            return formatCurrency(total)
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-white">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowConfigProdutoModal(false)
                        setProdutoSelecionadoConfig(null)
                      }}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        handleAdicionarAoCarrinho(produtoSelecionadoConfig)
                        setShowConfigProdutoModal(false)
                        setProdutoSelecionadoConfig(null)
                      }}
                      disabled={!tabelaPreco || !unidadesSelecionadas[produtoSelecionadoConfig.CODPROD]}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Adicionar ao Carrinho
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </>
  )
}