// ============================================
// SERVIDOR UNIFICADO - CONTAS A PAGAR
// API + Frontend em um único deploy
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// ============================================
// CONFIGURAÇÃO DE CORS
// ============================================

const allowedOrigins = [
    'https://contas-a-pagar-ytr6.onrender.com',
    'https://ir-comercio-portal-zcan.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Permite todas para frontend servido pelo mesmo servidor
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400
};

app.use(cors(corsOptions));

// ============================================
// MIDDLEWARES
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Log de requisições
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// ARMAZENAMENTO EM MEMÓRIA
// ============================================

let contas = [];

// Dados de exemplo
contas = [
    {
        id: '1',
        descricao: 'ENERGIA ELÉTRICA',
        valor: 350.00,
        data_vencimento: '2025-12-10',
        frequencia: 'PARCELA_UNICA',
        forma_pagamento: 'BOLETO',
        banco: 'BANCO DO BRASIL',
        status: 'PENDENTE',
        data_pagamento: null,
        observacoes: 'Conta de energia',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: '2',
        descricao: 'TELEFONE',
        valor: 89.90,
        data_vencimento: '2025-12-05',
        frequencia: 'PARCELA_UNICA',
        forma_pagamento: 'DEBITO',
        banco: 'BRADESCO',
        status: 'PENDENTE',
        data_pagamento: null,
        observacoes: 'Conta telefônica',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function calcularStatusDinamico(conta) {
    if (conta.status === 'PAGO') return 'PAGO';
    if (conta.status === 'CANCELADO') return 'CANCELADO';
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencimento = new Date(conta.data_vencimento + 'T00:00:00');
    vencimento.setHours(0, 0, 0, 0);
    
    const diff = Math.floor((vencimento - hoje) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return 'VENCIDO';
    if (diff <= 15) return 'IMINENTE';
    return 'PENDENTE';
}

function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================
// ROTAS DA API
// ============================================

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        totalContas: contas.length
    });
});

// GET /api/contas - Listar todas as contas
app.get('/api/contas', (req, res) => {
    try {
        const contasComStatus = contas.map(conta => ({
            ...conta,
            status_dinamico: calcularStatusDinamico(conta)
        }));
        
        res.json({
            success: true,
            data: contasComStatus,
            total: contasComStatus.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao listar contas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao listar contas',
            message: error.message
        });
    }
});

// GET /api/contas/:id - Buscar conta específica
app.get('/api/contas/:id', (req, res) => {
    try {
        const conta = contas.find(c => c.id === req.params.id);
        
        if (!conta) {
            return res.status(404).json({
                success: false,
                error: 'Conta não encontrada'
            });
        }
        
        res.json({
            success: true,
            data: {
                ...conta,
                status_dinamico: calcularStatusDinamico(conta)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar conta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar conta',
            message: error.message
        });
    }
});

// POST /api/contas - Criar nova conta
app.post('/api/contas', (req, res) => {
    try {
        const novaConta = {
            id: gerarId(),
            ...req.body,
            status: req.body.status || 'PENDENTE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (!novaConta.descricao || !novaConta.valor || !novaConta.data_vencimento) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios faltando',
                required: ['descricao', 'valor', 'data_vencimento']
            });
        }
        
        contas.push(novaConta);
        
        res.status(201).json({
            success: true,
            message: 'Conta criada com sucesso',
            data: {
                ...novaConta,
                status_dinamico: calcularStatusDinamico(novaConta)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao criar conta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar conta',
            message: error.message
        });
    }
});

// PUT /api/contas/:id - Atualizar conta completa
app.put('/api/contas/:id', (req, res) => {
    try {
        const index = contas.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Conta não encontrada'
            });
        }
        
        const contaAtualizada = {
            ...contas[index],
            ...req.body,
            id: req.params.id,
            updated_at: new Date().toISOString()
        };
        
        contas[index] = contaAtualizada;
        
        res.json({
            success: true,
            message: 'Conta atualizada com sucesso',
            data: {
                ...contaAtualizada,
                status_dinamico: calcularStatusDinamico(contaAtualizada)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar conta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar conta',
            message: error.message
        });
    }
});

// PATCH /api/contas/:id - Atualizar parcialmente
app.patch('/api/contas/:id', (req, res) => {
    try {
        const index = contas.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Conta não encontrada'
            });
        }
        
        contas[index] = {
            ...contas[index],
            ...req.body,
            id: req.params.id,
            updated_at: new Date().toISOString()
        };
        
        res.json({
            success: true,
            message: 'Conta atualizada com sucesso',
            data: {
                ...contas[index],
                status_dinamico: calcularStatusDinamico(contas[index])
            }
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar conta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar conta',
            message: error.message
        });
    }
});

// DELETE /api/contas/:id - Deletar conta
app.delete('/api/contas/:id', (req, res) => {
    try {
        const index = contas.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Conta não encontrada'
            });
        }
        
        const contaRemovida = contas.splice(index, 1)[0];
        
        res.json({
            success: true,
            message: 'Conta removida com sucesso',
            data: contaRemovida
        });
    } catch (error) {
        console.error('❌ Erro ao deletar conta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao deletar conta',
            message: error.message
        });
    }
});

// GET /api/dashboard - Estatísticas
app.get('/api/dashboard', (req, res) => {
    try {
        const stats = {
            total: contas.length,
            pagos: 0,
            vencidos: 0,
            iminentes: 0,
            pendentes: 0,
            valor_total: 0,
            valor_pago: 0,
            valor_pendente: 0
        };
        
        contas.forEach(conta => {
            const statusDinamico = calcularStatusDinamico(conta);
            stats.valor_total += parseFloat(conta.valor);
            
            if (statusDinamico === 'PAGO') {
                stats.pagos++;
                stats.valor_pago += parseFloat(conta.valor);
            } else {
                stats.valor_pendente += parseFloat(conta.valor);
                
                if (statusDinamico === 'VENCIDO') stats.vencidos++;
                else if (statusDinamico === 'IMINENTE') stats.iminentes++;
                else if (statusDinamico === 'PENDENTE') stats.pendentes++;
            }
        });
        
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao gerar dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar dashboard',
            message: error.message
        });
    }
});

// ============================================
// ROTA RAIZ - SERVIR FRONTEND
// ============================================

// Todas as outras rotas servem o index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// TRATAMENTO DE ERROS 404 PARA API
// ============================================

app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota da API não encontrada',
        path: req.path,
        method: req.method
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('');
    console.log('===============================================');
    console.log('🚀 SERVIDOR UNIFICADO - CONTAS A PAGAR');
    console.log('===============================================');
    console.log(`✅ Servidor rodando na porta: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📊 Total de contas: ${contas.length}`);
    console.log('');
    console.log('📋 Endpoints disponíveis:');
    console.log('   GET    /                - Frontend (Interface Visual)');
    console.log('   GET    /health          - Status do servidor');
    console.log('   GET    /api/contas      - Listar todas as contas');
    console.log('   GET    /api/contas/:id  - Buscar conta específica');
    console.log('   POST   /api/contas      - Criar nova conta');
    console.log('   PUT    /api/contas/:id  - Atualizar conta');
    console.log('   PATCH  /api/contas/:id  - Atualizar parcialmente');
    console.log('   DELETE /api/contas/:id  - Deletar conta');
    console.log('   GET    /api/dashboard   - Estatísticas');
    console.log('===============================================');
    console.log('');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;
