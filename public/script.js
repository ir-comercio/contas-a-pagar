// CONFIGURAÇÃO
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = '/api';
let contas = [];
let isOnline = false;
let sessionToken = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// INICIALIZAÇÃO
window.addEventListener('load', function() {
    setTimeout(function() {
        const splash = document.getElementById('splashScreen');
        const app = document.querySelector('.app-content');
        if (splash) splash.style.display = 'none';
        if (app) { app.style.display = 'block'; app.style.opacity = '1'; }
    }, 1000);
    
    const urlParams = new URLSearchParams(window.location.search);
    sessionToken = urlParams.get('sessionToken') || sessionStorage.getItem('contasPagarSession') || localStorage.getItem('contasPagarSession');
    if (!sessionToken) { window.location.href = PORTAL_URL; return; }
    sessionStorage.setItem('contasPagarSession', sessionToken);
    localStorage.setItem('contasPagarSession', sessionToken);
    updateMonthDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    loadContas();
    setInterval(loadContas, 10000);
});

// NAVEGAÇÃO DE MESES
function updateMonthDisplay() {
    const display = document.getElementById('currentMonthDisplay');
    if (display) display.textContent = `${meses[currentMonth]} ${currentYear}`;
    updateDashboard();
    filterContas();
}

window.previousMonth = function() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateMonthDisplay();
};

window.nextMonth = function() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateMonthDisplay();
};

// CONEXÃO
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: { 'X-Session-Token': sessionToken }
        });
        if (response.status === 401) { window.location.href = PORTAL_URL; return; }
        isOnline = response.ok;
        updateConnectionStatus();
    } catch (error) {
        isOnline = false;
        updateConnectionStatus();
    }
}

function updateConnectionStatus() {
    const elem = document.getElementById('connectionStatus');
    if (elem) elem.className = isOnline ? 'connection-status online' : 'connection-status offline';
}

// CARREGAR DADOS
async function loadContas() {
    if (!sessionToken) return;
    try {
        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: { 'X-Session-Token': sessionToken }
        });
        if (response.status === 401) { window.location.href = PORTAL_URL; return; }
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) {
            contas = data;
            updateAllFilters();
            updateDashboard();
            filterContas();
        }
    } catch (error) {}
}

// DASHBOARD
function updateDashboard() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const quinzeDias = new Date(hoje);
    quinzeDias.setDate(quinzeDias.getDate() + 15);
    
    const contasDoMes = contas.filter(c => {
        const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
        return dataVenc.getMonth() === currentMonth && dataVenc.getFullYear() === currentYear;
    });
    
    const pagos = contasDoMes.filter(c => c.status === 'PAGO').length;
    const vencido = contasDoMes.filter(c => {
        if (c.status === 'PAGO') return false;
        const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
        dataVenc.setHours(0, 0, 0, 0);
        return dataVenc < hoje;
    }).length;
    const iminente = contasDoMes.filter(c => {
        if (c.status === 'PAGO') return false;
        const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
        dataVenc.setHours(0, 0, 0, 0);
        return dataVenc >= hoje && dataVenc <= quinzeDias;
    }).length;
    const valorTotal = contasDoMes.reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);
    
    document.getElementById('statPagos').textContent = pagos;
    document.getElementById('statVencido').textContent = vencido;
    document.getElementById('statIminente').textContent = iminente;
    document.getElementById('statValorTotal').textContent = `R$ ${valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    const cardVencido = document.getElementById('cardVencido');
    const badgeVencido = document.getElementById('pulseBadgeVencido');
    if (vencido > 0) {
        cardVencido.classList.add('has-alert');
        badgeVencido.style.display = 'flex';
        badgeVencido.textContent = vencido;
    } else {
        cardVencido.classList.remove('has-alert');
        badgeVencido.style.display = 'none';
    }
    
    const cardIminente = document.getElementById('cardIminente');
    const badgeIminente = document.getElementById('pulseBadgeIminente');
    if (iminente > 0) {
        cardIminente.classList.add('has-warning');
        badgeIminente.style.display = 'flex';
        badgeIminente.textContent = iminente;
    } else {
        cardIminente.classList.remove('has-warning');
        badgeIminente.style.display = 'none';
    }
}

// FORMULÁRIO
window.toggleForm = function() {
    showFormModal(null);
};

function showFormModal(editingId) {
    const isEditing = editingId !== null;
    let conta = null;
    
    if (isEditing) {
        conta = contas.find(c => String(c.id) === String(editingId));
        if (!conta) {
            showMessage('Conta não encontrada!', 'error');
            return;
        }
    }

    const modalHTML = `
        <div class="modal-overlay" id="formModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${isEditing ? 'Editar Conta' : 'Nova Conta'}</h3>
                </div>
                
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchFormTab(0)">Dados da Conta</button>
                        <button class="tab-btn" onclick="switchFormTab(1)">Pagamento</button>
                    </div>

                    <form id="contaForm" onsubmit="handleSubmit(event)">
                        <input type="hidden" id="editId" value="${editingId || ''}">
                        
                        <div class="tab-content active" id="tab-conta">
                            <div class="form-grid">
                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <label for="descricao">Descrição *</label>
                                    <input type="text" id="descricao" value="${conta?.descricao || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="valor">Valor (R$) *</label>
                                    <input type="number" id="valor" step="0.01" min="0" value="${conta?.valor || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="data_vencimento">Vencimento *</label>
                                    <input type="date" id="data_vencimento" value="${conta?.data_vencimento || ''}" required>
                                </div>
                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <div class="checkbox-fixa-wrapper">
                                        <input type="checkbox" id="fixa" ${conta?.fixa ? 'checked' : ''}>
                                        <label for="fixa">Esta é uma conta fixa (se repetirá todos os meses)</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-pagamento">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="forma_pagamento">Forma de Pagamento *</label>
                                    <select id="forma_pagamento" required>
                                        <option value="">Selecione...</option>
                                        <option value="BOLETO" ${conta?.forma_pagamento === 'BOLETO' ? 'selected' : ''}>Boleto</option>
                                        <option value="CARTAO" ${conta?.forma_pagamento === 'CARTAO' ? 'selected' : ''}>Cartão</option>
                                        <option value="DINHEIRO" ${conta?.forma_pagamento === 'DINHEIRO' ? 'selected' : ''}>Dinheiro</option>
                                        <option value="TRANSFERENCIA" ${conta?.forma_pagamento === 'TRANSFERENCIA' ? 'selected' : ''}>Transferência</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="banco">Banco *</label>
                                    <select id="banco" required>
                                        <option value="">Selecione...</option>
                                        <option value="BANCO DO BRASIL" ${conta?.banco === 'BANCO DO BRASIL' ? 'selected' : ''}>Banco do Brasil</option>
                                        <option value="BRADESCO" ${conta?.banco === 'BRADESCO' ? 'selected' : ''}>Bradesco</option>
                                        <option value="SICOOB" ${conta?.banco === 'SICOOB' ? 'selected' : ''}>Sicoob</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="data_pagamento">Data do Pagamento</label>
                                    <input type="date" id="data_pagamento" value="${conta?.data_pagamento || ''}">
                                </div>
                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <label for="observacoes">Observações</label>
                                    <input type="text" id="observacoes" value="${conta?.observacoes || ''}">
                                </div>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="submit" class="save">${isEditing ? 'Atualizar' : 'Salvar'}</button>
                            <button type="button" class="secondary" onclick="closeFormModal()">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    ['descricao', 'observacoes'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.addEventListener('input', e => {
            const pos = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(pos, pos);
        });
    });
}

function closeFormModal() {
    const modal = document.getElementById('formModal');
    if (modal) modal.remove();
}

window.switchFormTab = function(index) {
    document.querySelectorAll('#formModal .tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    document.querySelectorAll('#formModal .tab-content').forEach((content, i) => {
        content.classList.toggle('active', i === index);
    });
};

// SUBMIT
async function handleSubmit(event) {
    event.preventDefault();
    
    const formData = {
        descricao: document.getElementById('descricao').value.trim(),
        valor: parseFloat(document.getElementById('valor').value),
        data_vencimento: document.getElementById('data_vencimento').value,
        forma_pagamento: document.getElementById('forma_pagamento').value,
        banco: document.getElementById('banco').value,
        data_pagamento: document.getElementById('data_pagamento').value || null,
        observacoes: document.getElementById('observacoes').value.trim() || null,
        fixa: document.getElementById('fixa').checked
    };

    const editId = document.getElementById('editId').value;
    if (editId) {
        const conta = contas.find(c => String(c.id) === String(editId));
        if (conta && !formData.data_pagamento) {
            formData.status = conta.status;
        } else {
            formData.status = formData.data_pagamento ? 'PAGO' : 'PENDENTE';
        }
    } else {
        formData.status = formData.data_pagamento ? 'PAGO' : 'PENDENTE';
    }

    try {
        const url = editId ? `${API_URL}/contas/${editId}` : `${API_URL}/contas`;
        const method = editId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify(formData)
        });

        if (response.status === 401) {
            window.location.href = PORTAL_URL;
            return;
        }

        if (!response.ok) throw new Error('Erro ao salvar');

        const savedData = await response.json();

        if (editId) {
            const index = contas.findIndex(c => String(c.id) === String(editId));
            if (index !== -1) contas[index] = savedData;
            showMessage('✅ Conta atualizada com sucesso!', 'success');
        } else {
            contas.push(savedData);
            showMessage('✅ Conta criada com sucesso!', 'success');
        }

        updateAllFilters();
        updateDashboard();
        filterContas();
        closeFormModal();
    } catch (error) {
        showMessage('❌ Erro ao salvar conta', 'error');
    }
}

// AÇÕES
window.togglePago = async function(id) {
    const conta = contas.find(c => String(c.id) === String(id));
    if (!conta) return;

    const novoStatus = conta.status === 'PAGO' ? 'PENDENTE' : 'PAGO';
    const novaData = novoStatus === 'PAGO' ? new Date().toISOString().split('T')[0] : null;

    const old = { status: conta.status, data: conta.data_pagamento };
    conta.status = novoStatus;
    conta.data_pagamento = novaData;
    updateDashboard();
    filterContas();

    try {
        const response = await fetch(`${API_URL}/contas/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({ status: novoStatus, data_pagamento: novaData })
        });

        if (response.status === 401) {
            window.location.href = PORTAL_URL;
            return;
        }

        if (!response.ok) throw new Error();

        const data = await response.json();
        const index = contas.findIndex(c => String(c.id) === String(id));
        if (index !== -1) contas[index] = data;
        
        showMessage(novoStatus === 'PAGO' ? '✅ Conta marcada como paga!' : '✅ Conta desmarcada', 'success');
    } catch (error) {
        conta.status = old.status;
        conta.data_pagamento = old.data;
        updateDashboard();
        filterContas();
        showMessage('❌ Erro ao atualizar status', 'error');
    }
};

window.editConta = function(id) {
    showFormModal(String(id));
};

window.deleteConta = async function(id) {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    const deleted = contas.find(c => String(c.id) === String(id));
    contas = contas.filter(c => String(c.id) !== String(id));
    updateAllFilters();
    updateDashboard();
    filterContas();
    showMessage('✅ Conta excluída com sucesso!', 'success');

    try {
        const response = await fetch(`${API_URL}/contas/${id}`, {
            method: 'DELETE',
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.status === 401) {
            window.location.href = PORTAL_URL;
            return;
        }

        if (!response.ok) throw new Error();
    } catch (error) {
        if (deleted) {
            contas.push(deleted);
            updateAllFilters();
            updateDashboard();
            filterContas();
            showMessage('❌ Erro ao excluir conta', 'error');
        }
    }
};

window.viewConta = function(id) {
    const conta = contas.find(c => String(c.id) === String(id));
    if (!conta) return;

    const modal = `
        <div class="modal-overlay" id="viewModal" onclick="if(event.target===this)closeViewModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Detalhes da Conta</h3>
                </div>
                <div class="info-section">
                    <p><strong>Descrição:</strong> ${conta.descricao}</p>
                    <p><strong>Valor:</strong> R$ ${parseFloat(conta.valor).toFixed(2)}</p>
                    <p><strong>Vencimento:</strong> ${formatDate(conta.data_vencimento)}</p>
                    <p><strong>Forma de Pagamento:</strong> ${conta.forma_pagamento}</p>
                    <p><strong>Banco:</strong> ${conta.banco}</p>
                    <p><strong>Conta Fixa:</strong> ${conta.fixa ? 'Sim' : 'Não'}</p>
                    ${conta.data_pagamento ? `<p><strong>Data do Pagamento:</strong> ${formatDate(conta.data_pagamento)}</p>` : '<p><strong>Status:</strong> Não pago</p>'}
                    ${conta.observacoes ? `<p><strong>Observações:</strong> ${conta.observacoes}</p>` : ''}
                </div>
                <div class="modal-actions">
                    <button class="secondary" onclick="closeViewModal()">Fechar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
};

window.closeViewModal = function() {
    const modal = document.getElementById('viewModal');
    if (modal) modal.remove();
};

// FILTROS
function updateAllFilters() {
    const bancos = new Set();
    contas.forEach(c => {
        if (c.banco?.trim()) bancos.add(c.banco.trim());
    });
    
    const select = document.getElementById('filterBanco');
    if (select) {
        const val = select.value;
        select.innerHTML = '<option value="">Todos</option>';
        Array.from(bancos).sort().forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            select.appendChild(opt);
        });
        select.value = val;
    }
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let temVencido = false, temIminente = false, temPago = false;
    
    contas.forEach(c => {
        if (c.status === 'PAGO') {
            temPago = true;
        } else {
            const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
            dataVenc.setHours(0, 0, 0, 0);
            if (dataVenc < hoje) {
                temVencido = true;
            } else {
                const quinze = new Date(hoje);
                quinze.setDate(quinze.getDate() + 15);
                if (dataVenc <= quinze) temIminente = true;
            }
        }
    });

    const statusSelect = document.getElementById('filterStatus');
    if (statusSelect) {
        const val = statusSelect.value;
        statusSelect.innerHTML = '<option value="">Todos</option>';
        if (temPago) statusSelect.innerHTML += '<option value="PAGO">Pago</option>';
        if (temVencido) statusSelect.innerHTML += '<option value="VENCIDO">Vencido</option>';
        if (temIminente) statusSelect.innerHTML += '<option value="IMINENTE">Iminente</option>';
        statusSelect.value = val;
    }
}

function filterContas() {
    const search = (document.getElementById('search')?.value || '').toLowerCase();
    const banco = document.getElementById('filterBanco')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';
    const pagamento = document.getElementById('filterPagamento')?.value || '';
    
    let filtered = contas.filter(c => {
        const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
        return dataVenc.getMonth() === currentMonth && dataVenc.getFullYear() === currentYear;
    });

    if (banco) filtered = filtered.filter(c => c.banco === banco);
    if (pagamento) filtered = filtered.filter(c => c.forma_pagamento === pagamento);
    
    if (status) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const quinze = new Date(hoje);
        quinze.setDate(quinze.getDate() + 15);
        
        filtered = filtered.filter(c => {
            if (status === 'PAGO') return c.status === 'PAGO';
            if (status === 'VENCIDO') {
                if (c.status === 'PAGO') return false;
                const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
                dataVenc.setHours(0, 0, 0, 0);
                return dataVenc < hoje;
            }
            if (status === 'IMINENTE') {
                if (c.status === 'PAGO') return false;
                const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
                dataVenc.setHours(0, 0, 0, 0);
                return dataVenc >= hoje && dataVenc <= quinze;
            }
            return true;
        });
    }

    if (search) {
        filtered = filtered.filter(c => 
            (c.descricao || '').toLowerCase().includes(search) ||
            (c.banco || '').toLowerCase().includes(search) ||
            (c.forma_pagamento || '').toLowerCase().includes(search)
        );
    }

    filtered.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
    renderContas(filtered);
}

// RENDERIZAÇÃO
function renderContas(lista) {
    const container = document.getElementById('contasContainer');
    if (!container) return;
    
    if (!lista.length) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary)">Nenhuma conta encontrada</div>';
        return;
    }

    const table = `
        <table>
            <thead>
                <tr>
                    <th style="width:40px;text-align:center">✓</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Banco</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th style="text-align:center">Ações</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(c => `
                    <tr class="${c.status === 'PAGO' ? 'row-pago' : ''}">
                        <td style="text-align:center">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="check-${c.id}" ${c.status === 'PAGO' ? 'checked' : ''} onchange="togglePago('${c.id}')" class="styled-checkbox">
                                <label for="check-${c.id}" class="checkbox-label-styled"></label>
                            </div>
                        </td>
                        <td>${c.descricao}${c.fixa ? ' <strong>(Fixa)</strong>' : ''}</td>
                        <td><strong>R$ ${parseFloat(c.valor).toFixed(2)}</strong></td>
                        <td>${formatDate(c.data_vencimento)}</td>
                        <td>${c.banco}</td>
                        <td>${c.forma_pagamento}</td>
                        <td>${getStatusBadge(getStatusDinamico(c))}</td>
                        <td style="text-align:center;white-space:nowrap">
                            <button onclick="viewConta('${c.id}')" class="action-btn view">Ver</button>
                            <button onclick="editConta('${c.id}')" class="action-btn edit">Editar</button>
                            <button onclick="deleteConta('${c.id}')" class="action-btn delete">Excluir</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// UTILITÁRIOS
function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
}

function getStatusDinamico(conta) {
    if (conta.status === 'PAGO') return 'PAGO';
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVenc = new Date(conta.data_vencimento + 'T00:00:00');
    dataVenc.setHours(0, 0, 0, 0);
    if (dataVenc < hoje) return 'VENCIDO';
    const quinze = new Date(hoje);
    quinze.setDate(quinze.getDate() + 15);
    if (dataVenc <= quinze) return 'IMINENTE';
    return 'PENDENTE';
}

function getStatusBadge(status) {
    const map = {
        'PAGO': { class: 'pago', text: 'Pago' },
        'VENCIDO': { class: 'vencido', text: 'Vencido' },
        'IMINENTE': { class: 'iminente', text: 'Iminente' },
        'PENDENTE': { class: 'pendente', text: 'Pendente' }
    };
    const s = map[status] || { class: 'pendente', text: status };
    return `<span class="badge ${s.class}">${s.text}</span>`;
}

function showMessage(message, type) {
    const old = document.querySelectorAll('.floating-message');
    old.forEach(m => m.remove());
    
    const div = document.createElement('div');
    div.className = `floating-message ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}
