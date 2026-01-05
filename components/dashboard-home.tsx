"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  Package,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Wifi,
  WifiOff
} from "lucide-react"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { toast } from "sonner"
import { format, subDays, startOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

interface DashboardData {
  kpis: {
    faturamento: number
    ticketMedio: number
    volumePedidos: number
    totalClientes: number
    variacaoFaturamento: number
    variacaoTicket: number
    variacaoPedidos: number
  }
  vendasPorDia: Array<{
    data: string
    valor: number
    pedidos: number
  }>
  topClientes: Array<{
    codParc: number
    nome: string
    valor: number
    pedidos: number
  }>
  topProdutos: Array<{
    codProd: number
    descricao: string
    quantidade: number
    valor: number
  }>
}

export default function DashboardHome() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [periodo, setPeriodo] = useState('30')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user) {
      setCurrentUser(user)
      const hoje = new Date()
      const inicio = subDays(hoje, 30)
      setDataInicio(format(inicio, 'yyyy-MM-dd'))
      setDataFim(format(hoje, 'yyyy-MM-dd'))
    }
    setLoading(false)

    setIsOnline(navigator.onLine)
    setIsMobile(window.innerWidth < 768)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleResize = () => setIsMobile(window.innerWidth < 768)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (dataInicio && dataFim && currentUser && isOnline) {
      carregarDashboard()
    }
  }, [dataInicio, dataFim, currentUser, isOnline])

  const carregarDashboard = async () => {
    if (!isOnline) return
    setLoading(true)
    try {
      const notasResponse = await fetch('/api/sankhya/notas/loadrecords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, dataInicio, dataFim })
      })

      if (!notasResponse.ok) throw new Error('Erro ao buscar notas')

      const { cabecalhos, itens } = await notasResponse.json()

      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const [parceiros, produtos] = await Promise.all([
        OfflineDataService.getParceiros(),
        OfflineDataService.getProdutos({ ativo: 'S' })
      ])

      const parceirosMap = new Map(parceiros.map((p: any) => [p.CODPARC, p]))
      const produtosMap = new Map(produtos.map((p: any) => [p.CODPROD, p]))

      const faturamentoTotal = cabecalhos.reduce((sum: number, c: any) => 
        sum + parseFloat(c.VLRNOTA || 0), 0)
      const volumePedidos = cabecalhos.length
      const ticketMedio = volumePedidos > 0 ? faturamentoTotal / volumePedidos : 0
      const clientesUnicos = new Set(cabecalhos.map((c: any) => c.CODPARC)).size

      const diasPeriodo = Math.ceil((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / (1000 * 60 * 60 * 24))
      const dataInicioAnterior = format(subDays(new Date(dataInicio), diasPeriodo), 'yyyy-MM-dd')
      const dataFimAnterior = format(subDays(new Date(dataInicio), 1), 'yyyy-MM-dd')

      const notasAnterioresResponse = await fetch('/api/sankhya/notas/loadrecords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, dataInicio: dataInicioAnterior, dataFim: dataFimAnterior })
      }).catch(() => ({ json: () => ({ cabecalhos: [] }) }))

      const { cabecalhos: cabecalhosAnteriores } = await notasAnterioresResponse.json()
      const faturamentoAnterior = cabecalhosAnteriores.reduce((sum: number, c: any) => 
        sum + parseFloat(c.VLRNOTA || 0), 0)
      const pedidosAnteriores = cabecalhosAnteriores.length
      const ticketAnterior = pedidosAnteriores > 0 ? faturamentoAnterior / pedidosAnteriores : 0

      const variacaoFaturamento = faturamentoAnterior > 0 
        ? ((faturamentoTotal - faturamentoAnterior) / faturamentoAnterior) * 100 : 0
      const variacaoPedidos = pedidosAnteriores > 0 
        ? ((volumePedidos - pedidosAnteriores) / pedidosAnteriores) * 100 : 0
      const variacaoTicket = ticketAnterior > 0 
        ? ((ticketMedio - ticketAnterior) / ticketAnterior) * 100 : 0

      const vendasPorDiaMap = new Map<string, { valor: number, pedidos: number }>()
      cabecalhos.forEach((c: any) => {
        const data = c.DTNEG
        if (!vendasPorDiaMap.has(data)) {
          vendasPorDiaMap.set(data, { valor: 0, pedidos: 0 })
        }
        const entry = vendasPorDiaMap.get(data)!
        entry.valor += parseFloat(c.VLRNOTA || 0)
        entry.pedidos += 1
      })

      const vendasPorDia = Array.from(vendasPorDiaMap.entries())
        .map(([data, dados]) => {
          try {
            const parts = data.split('/')
            if (parts.length === 3) {
              return { data: `${parts[0]}/${parts[1]}`, ...dados }
            }
            return { data, ...dados }
          } catch {
            return { data, ...dados }
          }
        })
        .sort((a, b) => a.data.localeCompare(b.data))

      const clientesMap = new Map<number, { valor: number, pedidos: number }>()
      cabecalhos.forEach((c: any) => {
        const codParc = c.CODPARC
        if (!clientesMap.has(codParc)) {
          clientesMap.set(codParc, { valor: 0, pedidos: 0 })
        }
        const entry = clientesMap.get(codParc)!
        entry.valor += parseFloat(c.VLRNOTA || 0)
        entry.pedidos += 1
      })

      const topClientes = Array.from(clientesMap.entries())
        .map(([codParc, dados]) => ({
          codParc,
          nome: parceirosMap.get(codParc)?.NOMEPARC || `Cliente ${codParc}`,
          ...dados
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)

      const produtosMapVendas = new Map<number, { quantidade: number, valor: number }>()
      itens.forEach((item: any) => {
        const codProd = item.CODPROD
        if (!produtosMapVendas.has(codProd)) {
          produtosMapVendas.set(codProd, { quantidade: 0, valor: 0 })
        }
        const entry = produtosMapVendas.get(codProd)!
        entry.quantidade += parseFloat(item.QTDNEG || 0)
        entry.valor += parseFloat(item.VLRTOT || 0)
      })

      const topProdutos = Array.from(produtosMapVendas.entries())
        .map(([codProd, dados]) => ({
          codProd,
          descricao: produtosMap.get(codProd)?.DESCRPROD || `Produto ${codProd}`,
          ...dados
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)

      setDashboardData({
        kpis: {
          faturamento: faturamentoTotal,
          ticketMedio,
          volumePedidos,
          totalClientes: clientesUnicos,
          variacaoFaturamento,
          variacaoTicket,
          variacaoPedidos
        },
        vendasPorDia,
        topClientes,
        topProdutos
      })
    } catch (error: any) {
      console.error('Erro ao carregar dashboard:', error)
      toast.error('Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const handlePeriodoChange = (value: string) => {
    setPeriodo(value)
    const hoje = new Date()
    let inicio: Date

    switch (value) {
      case '7':
        inicio = subDays(hoje, 7)
        break
      case '30':
        inicio = subDays(hoje, 30)
        break
      case '90':
        inicio = subDays(hoje, 90)
        break
      case 'mes':
        inicio = startOfMonth(hoje)
        break
      default:
        inicio = subDays(hoje, 30)
    }

    setDataInicio(format(inicio, 'yyyy-MM-dd'))
    setDataFim(format(hoje, 'yyyy-MM-dd'))
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-24">
      {/* Header com status online */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isMobile ? 'Início' : 'Dashboard de Vendas'}
          </h2>
          {!isMobile && (
            <p className="text-muted-foreground">
              Análise estratégica de performance comercial
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Cards de IA - Principal Feature */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <button 
          onClick={() => isOnline && router.push('/dashboard/analise')}
          disabled={!isOnline}
          className="text-left w-full"
        >
          <Card className={`relative overflow-hidden transition-all duration-300 ${
            isOnline 
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-lg hover:shadow-xl hover:scale-[1.02] cursor-pointer' 
              : 'bg-gray-400 cursor-not-allowed opacity-60'
          }`}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 md:space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-yellow-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-white">IA Análise de Dados</h3>
                    <p className="text-xs md:text-sm text-blue-100 mt-1">
                      Gere gráficos e widgets inteligentes com base em perguntas sobre seus dados
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-white/70" />
              </div>
              {!isOnline && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-full text-sm font-medium text-gray-700">
                    <WifiOff className="h-4 w-4" />
                    Requer conexão
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </button>

        <button 
          onClick={() => isOnline && router.push('/dashboard/chat')}
          disabled={!isOnline}
          className="text-left w-full"
        >
          <Card className={`relative overflow-hidden transition-all duration-300 ${
            isOnline 
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-lg hover:shadow-xl hover:scale-[1.02] cursor-pointer' 
              : 'bg-gray-400 cursor-not-allowed opacity-60'
          }`}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 md:space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-yellow-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-white">IA Assistente</h3>
                    <p className="text-xs md:text-sm text-emerald-100 mt-1">
                      Converse naturalmente e obtenha respostas sobre vendas, clientes e produtos
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-white/70" />
              </div>
              {!isOnline && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-full text-sm font-medium text-gray-700">
                    <WifiOff className="h-4 w-4" />
                    Requer conexão
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Filtro de período */}
      <div className="flex items-center gap-2 md:gap-3">
        <Select value={periodo} onValueChange={handlePeriodoChange}>
          <SelectTrigger className="w-[140px] md:w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
          </SelectContent>
        </Select>
        
        <Button 
          onClick={carregarDashboard} 
          disabled={loading || !isOnline}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Loading state */}
      {loading && !dashboardData && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center space-y-3">
            <RefreshCw className="h-6 w-6 md:h-8 md:w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        </div>
      )}

      {/* Offline message */}
      {!isOnline && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          <CardContent className="py-4 text-center">
            <WifiOff className="h-8 w-8 mx-auto text-orange-600 dark:text-orange-400 mb-2" />
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Dashboard indisponível offline. Conecte-se para ver os dados.
            </p>
          </CardContent>
        </Card>
      )}

      {dashboardData && isOnline && (
        <>
          {/* KPIs - Layout Mobile Otimizado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Card className="border-l-4 border-l-blue-600 shadow-sm">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Faturamento</span>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-base md:text-xl font-bold text-slate-800 dark:text-white">
                  {formatCurrency(dashboardData.kpis.faturamento)}
                </div>
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  dashboardData.kpis.variacaoFaturamento >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardData.kpis.variacaoFaturamento >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>{formatPercent(dashboardData.kpis.variacaoFaturamento)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-600 shadow-sm">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Ticket Médio</span>
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-base md:text-xl font-bold text-slate-800 dark:text-white">
                  {formatCurrency(dashboardData.kpis.ticketMedio)}
                </div>
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  dashboardData.kpis.variacaoTicket >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardData.kpis.variacaoTicket >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>{formatPercent(dashboardData.kpis.variacaoTicket)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-cyan-600 shadow-sm">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Vendas</span>
                  <ShoppingCart className="h-4 w-4 text-cyan-600" />
                </div>
                <div className="text-base md:text-xl font-bold text-slate-800 dark:text-white">
                  {dashboardData.kpis.volumePedidos}
                </div>
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  dashboardData.kpis.variacaoPedidos >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardData.kpis.variacaoPedidos >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>{formatPercent(dashboardData.kpis.variacaoPedidos)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-600 shadow-sm">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Clientes</span>
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-base md:text-xl font-bold text-slate-800 dark:text-white">
                  {dashboardData.kpis.totalClientes}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  No período
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Vendas - Mobile Optimized */}
          {!isMobile && dashboardData.vendasPorDia.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base text-slate-800 dark:text-white">
                  <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                  Evolução de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dashboardData.vendasPorDia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="data" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    />
                    <Bar dataKey="valor" fill="#1e40af" name="Faturamento" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Clientes - Mobile Card Style */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base text-slate-800 dark:text-white">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />
                Top 10 Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {dashboardData.topClientes.map((cliente, index) => (
                  <div key={cliente.codParc} className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full font-semibold text-xs md:text-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs md:text-sm text-slate-800 dark:text-white truncate">{cliente.nome}</p>
                        <p className="text-xs text-muted-foreground">{cliente.pedidos} pedidos</p>
                      </div>
                    </div>
                    <span className="font-semibold text-xs md:text-sm text-blue-600 flex-shrink-0 ml-2">
                      {formatCurrency(cliente.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Produtos - Mobile Card Style */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base text-slate-800 dark:text-white">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                Top 10 Produtos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {dashboardData.topProdutos.map((produto, index) => (
                  <div key={produto.codProd} className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full font-semibold text-xs md:text-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs md:text-sm text-slate-800 dark:text-white truncate">{produto.descricao}</p>
                        <p className="text-xs text-muted-foreground">Qtd: {produto.quantidade.toFixed(0)}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-xs md:text-sm text-emerald-600 flex-shrink-0 ml-2">
                      {formatCurrency(produto.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
