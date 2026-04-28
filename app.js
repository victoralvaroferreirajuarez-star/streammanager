import './styles.css'
import { supabase } from './supabase.js'
import { currencies, mainCurrency, convertToMainCurrency } from './currencies.js'
import Chart from 'chart.js/auto'

let accounts = []
let profiles = []
let currentView = 'dashboard'
let accountToDelete = null
let profileToDelete = null
let editingAccountId = null
let incomeChart = null
let editingProfileId = null

document.addEventListener('DOMContentLoaded', () => {
    initializeApp()
    setupEventListeners()
})

async function loadData() {
    try {
        const { data: accountsData, error: accountsError } = await supabase
            .from('accounts')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (accountsError) throw accountsError
        accounts = accountsData || []
        
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (profilesError) throw profilesError
        profiles = profilesData || []
        
        updateProfileStatuses()
    } catch (error) {
        console.error('Error loading data:', error)
        showToast('Error al cargar datos de Supabase', 'error')
    }
}

function updateProfileStatuses() {
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    profiles.forEach(profile => {
        const renewalDate = new Date(profile.renewal_date)
        
        if (renewalDate < now) {
            profile.status = 'expired'
        } else if (renewalDate <= nextWeek) {
            profile.status = 'expiring'
        } else {
            profile.status = 'active'
        }
    })
}

async function saveAccount(accountData) {
    try {
        const { error } = await supabase
            .from('accounts')
            .upsert([accountData])
        
        if (error) throw error
        
        if (accountData.id && accounts.find(a => a.id === accountData.id)) {
            const index = accounts.findIndex(a => a.id === accountData.id)
            accounts[index] = accountData
        } else {
            accounts.unshift(accountData)
        }
        
        return true
    } catch (error) {
        console.error('Error saving account:', error)
        showToast('Error al guardar cuenta', 'error')
        return false
    }
}

async function deleteAccount(accountId) {
    try {
        const { error } = await supabase
            .from('accounts')
            .delete()
            .eq('id', accountId)
        
        if (error) throw error
        
        accounts = accounts.filter(a => a.id !== accountId)
        profiles = profiles.filter(p => p.account_id !== accountId)
        
        return true
    } catch (error) {
        console.error('Error deleting account:', error)
        showToast('Error al eliminar cuenta', 'error')
        return false
    }
}

async function saveProfile(profileData) {
    try {
        const { error } = await supabase
            .from('profiles')
            .upsert([profileData])
        
        if (error) throw error
        
        if (profileData.id && profiles.find(p => p.id === profileData.id)) {
            const index = profiles.findIndex(p => p.id === profileData.id)
            profiles[index] = profileData
        } else {
            profiles.unshift(profileData)
        }
        
        updateAccountPrice(profileData.account_id)
        return true
    } catch (error) {
        console.error('Error saving profile:', error)
        showToast('Error al guardar perfil', 'error')
        return false
    }
}

async function deleteProfile(profileId) {
    try {
        const profile = profiles.find(p => p.id === profileId)
        const accountId = profile ? profile.account_id : null
        
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profileId)
        
        if (error) throw error
        
        profiles = profiles.filter(p => p.id !== profileId)
        
        if (accountId) {
            await updateAccountPrice(accountId)
        }
        
        return true
    } catch (error) {
        console.error('Error deleting profile:', error)
        showToast('Error al eliminar perfil', 'error')
        return false
    }
}

async function updateAccountPrice(accountId) {
    const accountProfiles = profiles.filter(p => p.account_id === accountId)
    const totalPrice = accountProfiles.reduce((sum, p) => sum + parseFloat(p.price || 0), 0)
    
    const account = accounts.find(a => a.id === accountId)
    if (account) {
        account.total_price = totalPrice
        await saveAccount(account)
    }
}

async function initializeApp() {
    await loadData()
    updateCurrentDate()
    renderDashboard()
    renderAccounts()
    renderProfiles()
    renderIncome()
    renderAlerts()
    updateAlertBadge()
}

function updateCurrentDate() {
    const now = new Date()
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-ES', options)
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault()
            const view = item.dataset.view
            if (view) switchView(view)
        })
    })

    document.getElementById('addAccountBtn').addEventListener('click', () => openAccountModal())
    document.getElementById('closeAccountModal').addEventListener('click', () => closeAccountModal())
    document.getElementById('cancelAccountBtn').addEventListener('click', () => closeAccountModal())
    document.getElementById('accountForm').addEventListener('submit', handleAccountSubmit)

    document.getElementById('addProfileBtn').addEventListener('click', () => openProfileModal())
    document.getElementById('closeProfileModal').addEventListener('click', () => closeProfileModal())
    document.getElementById('cancelProfileBtn').addEventListener('click', () => closeProfileModal())
    document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit)

    document.getElementById('cancelAccountDelete').addEventListener('click', () => closeDeleteAccountModal())
    document.getElementById('confirmAccountDelete').addEventListener('click', confirmDeleteAccount)

    document.getElementById('cancelProfileDelete').addEventListener('click', () => closeDeleteProfileModal())
    document.getElementById('confirmProfileDelete').addEventListener('click', confirmDeleteProfile)

    document.getElementById('searchAccount').addEventListener('input', renderAccounts)
    document.getElementById('searchProfile').addEventListener('input', renderProfiles)
    document.getElementById('filterStatus').addEventListener('change', renderProfiles)

    document.querySelectorAll('.alert-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.alert-filter').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            renderAlerts(btn.dataset.filter)
        })
    })

    document.getElementById('accountModal').addEventListener('click', (e) => {
        if (e.target.id === 'accountModal') closeAccountModal()
    })
    document.getElementById('profileModal').addEventListener('click', (e) => {
        if (e.target.id === 'profileModal') closeProfileModal()
    })
    document.getElementById('deleteAccountModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteAccountModal') closeDeleteAccountModal()
    })
    document.getElementById('deleteProfileModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteProfileModal') closeDeleteProfileModal()
    })

    document.getElementById('exportBtn').addEventListener('click', exportData)
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click()
    })
    document.getElementById('importFile').addEventListener('change', importData)
}

function switchView(view) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view)
    })
    
    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === view)
    })
    
    currentView = view
}

function renderDashboard() {
    const stats = calculateStats()
    
    document.getElementById('totalAccounts').textContent = stats.accounts
    document.getElementById('totalProfiles').textContent = stats.profiles
    document.getElementById('expiringSoon').textContent = stats.expiring
    
    const totalIncomeEUR = profiles.reduce((sum, p) => {
        return sum + convertToMainCurrency(parseFloat(p.price || 0), p.currency || 'EUR')
    }, 0)
    
    document.getElementById('totalIncomeEUR').textContent = formatCurrency(totalIncomeEUR, 'EUR')
    
    renderRecentActivity()
}

function calculateStats() {
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const accountsCount = accounts.length
    const profilesCount = profiles.length
    let expiring = 0
    let monthlyIncome = 0
    
    profiles.forEach(profile => {
        const renewalDate = new Date(profile.renewal_date)
        
        if (renewalDate <= nextWeek && renewalDate > now) {
            expiring++
        }
        
        if (renewalDate.getMonth() === now.getMonth() && 
            renewalDate.getFullYear() === now.getFullYear()) {
            const converted = convertToMainCurrency(parseFloat(profile.price || 0), profile.currency || 'EUR')
            monthlyIncome += converted
        }
    })
    
    return { 
        accounts: accountsCount, 
        profiles: profilesCount, 
        expiring, 
        monthlyIncome 
    }
}

function renderRecentActivity() {
    const container = document.getElementById('recentActivity')
    
    if (profiles.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay actividad reciente</p>'
        return
    }
    
    const recentProfiles = [...profiles].slice(0, 5)
    
    container.innerHTML = recentProfiles.map(profile => {
        const account = accounts.find(a => a.id === profile.account_id)
        const renewalDate = new Date(profile.renewal_date)
        
        let iconClass = 'add'
        let icon = 'fa-user-plus'
        
        if (renewalDate <= new Date()) {
            iconClass = 'renew'
            icon = 'fa-sync'
        }
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${iconClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="activity-info">
                    <h4>${profile.name}</h4>
                    <p>${account ? account.platform : 'N/A'} - ${formatDate(profile.start_date)}</p>
                </div>
            </div>
        `
    }).join('')
}

function renderAccounts() {
    const searchTerm = document.getElementById('searchAccount').value.toLowerCase()
    const tbody = document.getElementById('accountsTableBody')
    
    let filteredAccounts = accounts.filter(account => {
        return account.platform.toLowerCase().includes(searchTerm) ||
               account.email.toLowerCase().includes(searchTerm)
    })
    
    if (filteredAccounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    ${accounts.length === 0 ? 'No hay cuentas registradas' : 'No se encontraron cuentas'}
                </td>
            </tr>
        `
        return
    }
    
    tbody.innerHTML = filteredAccounts.map(account => {
        const accountProfiles = profiles.filter(p => p.account_id === account.id)
        const activeProfiles = accountProfiles.filter(p => p.status === 'active').length
        
        return `
            <tr>
                <td>
                    <span class="platform-icon ${getPlatformClass(account.platform)}">
                        <i class="fab ${getPlatformIcon(account.platform)}"></i>
                        ${account.platform}
                    </span>
                </td>
                <td>${account.email}</td>
                <td>${accountProfiles.length} perfiles</td>
                <td>${activeProfiles} activos</td>
                <td>${formatCurrency(account.total_price || 0)}</td>
                <td>
                    <button class="btn-icon" onclick="editAccount('${account.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="viewAccountProfiles('${account.id}')" title="Ver Perfiles">
                        <i class="fas fa-users"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteAccountFn('${account.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
    }).join('')
}

function renderProfiles() {
    const searchTerm = document.getElementById('searchProfile').value.toLowerCase()
    const filterStatus = document.getElementById('filterStatus').value
    const tbody = document.getElementById('profilesTableBody')
    
    let filteredProfiles = profiles.filter(profile => {
        const matchesSearch = profile.name.toLowerCase().includes(searchTerm) ||
                            (profile.profile_email && profile.profile_email.toLowerCase().includes(searchTerm))
        const matchesFilter = filterStatus === 'all' || filterStatus === profile.status
        
        return matchesSearch && matchesFilter
    })
    
    if (filteredProfiles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    ${profiles.length === 0 ? 'No hay perfiles registrados' : 'No se encontraron perfiles'}
                </td>
            </tr>
        `
        return
    }
    
    tbody.innerHTML = filteredProfiles.map(profile => {
        const account = accounts.find(a => a.id === profile.account_id)
        
        return `
            <tr>
                <td><strong>${profile.name}</strong></td>
                <td>${profile.profile_email || '-'}</td>
                <td>${account ? account.platform : 'N/A'}</td>
                <td>${formatCurrency(profile.price, profile.currency)}</td>
                <td>${formatDate(profile.start_date)}</td>
                <td>${formatDate(profile.renewal_date)}</td>
                <td><span class="status-badge ${profile.status}">${getStatusLabel(profile.status)}</span></td>
                <td>${profile.notes || '-'}</td>
                <td>
                    <button class="btn-icon" onclick="editProfile('${profile.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteProfileFn('${profile.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
    }).join('')
}

function getPlatformClass(platform) {
    const classes = {
        'Netflix': 'netflix',
        'Spotify': 'spotify',
        'Disney+': 'disney',
        'HBO Max': 'hbo',
        'Amazon Prime': 'amazon',
        'YouTube Premium': 'youtube',
        'Apple TV+': 'apple',
        'Paramount+': 'paramount',
        'Crunchyroll': 'crunchyroll'
    }
    return classes[platform] || ''
}

function getPlatformIcon(platform) {
    const icons = {
        'Netflix': 'fa-netflix',
        'Spotify': 'fa-spotify',
        'Disney+': 'fa-disney',
        'HBO Max': 'fa-hbo',
        'Amazon Prime': 'fa-amazon',
        'YouTube Premium': 'fa-youtube',
        'Apple TV+': 'fa-apple',
        'Paramount+': 'fa-paramount',
        'Crunchyroll': 'fa-crunchyroll'
    }
    return icons[platform] || 'fa-play'
}

function getStatusLabel(status) {
    const labels = {
        active: 'Activo',
        expiring: 'Por Vencer',
        expired: 'Expirado'
    }
    return labels[status] || status
}

function openAccountModal(accountId = null) {
    const modal = document.getElementById('accountModal')
    const title = document.getElementById('accountModalTitle')
    
    document.getElementById('accountForm').reset()
    editingAccountId = accountId
    
    if (accountId) {
        const account = accounts.find(a => a.id === accountId)
        if (account) {
            title.textContent = 'Editar Cuenta'
            document.getElementById('accountId').value = account.id
            document.getElementById('platform').value = account.platform
            document.getElementById('accountEmail').value = account.email
            document.getElementById('accountPassword').value = account.password || ''
        }
    } else {
        title.textContent = 'Nueva Cuenta'
        document.getElementById('accountId').value = ''
    }
    
    modal.classList.add('active')
}

function closeAccountModal() {
    document.getElementById('accountModal').classList.remove('active')
    editingAccountId = null
}

async function handleAccountSubmit(e) {
    e.preventDefault()
    
    const accountData = {
        id: document.getElementById('accountId').value || generateId(),
        platform: document.getElementById('platform').value,
        email: document.getElementById('accountEmail').value,
        password: document.getElementById('accountPassword').value
    }
    
    const success = await saveAccount(accountData)
    
    if (success) {
        showToast(editingAccountId ? 'Cuenta actualizada correctamente' : 'Cuenta agregada correctamente', 'success')
        closeAccountModal()
        renderAll()
    }
}

function editAccount(accountId) {
    openAccountModal(accountId)
}

function viewAccountProfiles(accountId) {
    switchView('profiles')
    document.getElementById('searchProfile').value = ''
    document.getElementById('filterStatus').value = 'all'
    renderProfiles()
}

function deleteAccountFn(accountId) {
    accountToDelete = accountId
    document.getElementById('deleteAccountModal').classList.add('active')
}

function closeDeleteAccountModal() {
    accountToDelete = null
    document.getElementById('deleteAccountModal').classList.remove('active')
}

async function confirmDeleteAccount() {
    if (accountToDelete) {
        const success = await deleteAccount(accountToDelete)
        if (success) {
            showToast('Cuenta eliminada correctamente', 'success')
            renderAll()
        }
    }
    closeDeleteAccountModal()
}

function openProfileModal(profileId = null) {
    const modal = document.getElementById('profileModal')
    const title = document.getElementById('profileModalTitle')
    
    document.getElementById('profileForm').reset()
    document.getElementById('profileStartDate').valueAsDate = new Date()
    
    populateAccountsSelect()
    populateCurrencySelect()
    
    editingProfileId = profileId
    
    if (profileId) {
        const profile = profiles.find(p => p.id === profileId)
        if (profile) {
            title.textContent = 'Editar Perfil'
            document.getElementById('profileId').value = profile.id
            document.getElementById('profileAccountId').value = profile.account_id
            document.getElementById('profileName').value = profile.name
            document.getElementById('profileEmail').value = profile.profile_email || ''
            document.getElementById('profilePrice').value = profile.price
            document.getElementById('profileCurrency').value = profile.currency || 'EUR'
            document.getElementById('profileStartDate').value = profile.start_date
            document.getElementById('profileNotes').value = profile.notes || ''
        }
    } else {
        title.textContent = 'Nuevo Perfil'
        document.getElementById('profileId').value = ''
        document.getElementById('profileCurrency').value = 'EUR'
    }
    
    modal.classList.add('active')
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active')
    editingProfileId = null
}

function populateAccountsSelect() {
    const select = document.getElementById('profileAccountId')
    select.innerHTML = '<option value="">Seleccionar cuenta...</option>'
    
    accounts.forEach(account => {
        select.innerHTML += `
            <option value="${account.id}">${account.platform} - ${account.email}</option>
        `
    })
}

function populateCurrencySelect() {
    const select = document.getElementById('profileCurrency')
    select.innerHTML = ''
    
    currencies.forEach(currency => {
        const selected = currency.code === 'EUR' ? 'selected' : ''
        select.innerHTML += `
            <option value="${currency.code}" ${selected}>${currency.symbol} ${currency.name} (${currency.code})</option>
        `
    })
}

async function handleProfileSubmit(e) {
    e.preventDefault()
    
    const startDate = document.getElementById('profileStartDate').value
    const renewalDate = new Date(startDate)
    renewalDate.setMonth(renewalDate.getMonth() + 1)
    
    const profileData = {
        id: document.getElementById('profileId').value || generateId(),
        account_id: document.getElementById('profileAccountId').value,
        name: document.getElementById('profileName').value,
        profile_email: document.getElementById('profileEmail').value,
        price: parseFloat(document.getElementById('profilePrice').value),
        currency: document.getElementById('profileCurrency').value,
        start_date: startDate,
        renewal_date: renewalDate.toISOString().split('T')[0],
        notes: document.getElementById('profileNotes').value
    }
    
    const success = await saveProfile(profileData)
    
    if (success) {
        showToast(editingProfileId ? 'Perfil actualizado correctamente' : 'Perfil agregado correctamente', 'success')
        closeProfileModal()
        renderAll()
    }
}

function editProfile(profileId) {
    openProfileModal(profileId)
}

function deleteProfileFn(profileId) {
    profileToDelete = profileId
    document.getElementById('deleteProfileModal').classList.add('active')
}

function closeDeleteProfileModal() {
    profileToDelete = null
    document.getElementById('deleteProfileModal').classList.remove('active')
}

async function confirmDeleteProfile() {
    if (profileToDelete) {
        const success = await deleteProfile(profileToDelete)
        if (success) {
            showToast('Perfil eliminado correctamente', 'success')
            renderAll()
        }
    }
    closeDeleteProfileModal()
}

function renderIncome() {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
    
    const thisMonthProfiles = profiles.filter(p => {
        const renewalDate = new Date(p.renewal_date)
        return renewalDate.getMonth() === thisMonth && renewalDate.getFullYear() === thisYear
    })
    const thisMonthTotal = thisMonthProfiles.reduce((sum, p) => {
        return sum + convertToMainCurrency(parseFloat(p.price || 0), p.currency || 'EUR')
    }, 0)
    
    const lastMonthProfiles = profiles.filter(p => {
        const renewalDate = new Date(p.renewal_date)
        return renewalDate.getMonth() === lastMonth && renewalDate.getFullYear() === lastMonthYear
    })
    const lastMonthTotal = lastMonthProfiles.reduce((sum, p) => {
        return sum + convertToMainCurrency(parseFloat(p.price || 0), p.currency || 'EUR')
    }, 0)
    
    const totalIncome = profiles.reduce((sum, p) => {
        return sum + convertToMainCurrency(parseFloat(p.price || 0), p.currency || 'EUR')
    }, 0)
    
    document.getElementById('thisMonthIncome').textContent = formatCurrency(thisMonthTotal, 'EUR')
    document.getElementById('lastMonthIncome').textContent = formatCurrency(lastMonthTotal, 'EUR')
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome, 'EUR')
    
    renderIncomeChart()
    renderIncomeHistory()
}

function renderIncomeChart() {
    const ctx = document.getElementById('incomeChartCanvas')
    
    if (!ctx) return
    
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({
            name: date.toLocaleDateString('es-ES', { month: 'short' }),
            month: date.getMonth(),
            year: date.getFullYear()
        })
    }
    
    const data = months.map(m => {
        const monthProfiles = profiles.filter(p => {
            const renewalDate = new Date(p.renewal_date)
            return renewalDate.getMonth() === m.month && renewalDate.getFullYear() === m.year
        })
        return monthProfiles.reduce((sum, p) => sum + convertToMainCurrency(parseFloat(p.price || 0), p.currency || 'EUR'), 0)
    })
    
    if (incomeChart) {
        incomeChart.data.labels = months.map(m => m.name)
        incomeChart.data.datasets[0].data = data
        incomeChart.update()
    } else {
        incomeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => m.name),
                datasets: [{
                    label: 'Ingresos (EUR)',
                    data: data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '€' + context.parsed.y.toFixed(2)
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '€' + value
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        })
    }
}

function renderIncomeHistory() {
    const tbody = document.getElementById('incomeTableBody')
    
    const sortedProfiles = [...profiles].sort((a, b) => 
        new Date(b.renewal_date) - new Date(a.renewal_date)
    )
    
    if (sortedProfiles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">No hay ingresos registrados</td>
            </tr>
        `
        return
    }
    
    tbody.innerHTML = sortedProfiles.map(profile => {
        const account = accounts.find(a => a.id === profile.account_id)
        
        return `
            <tr>
                <td>${formatDate(profile.renewal_date)}</td>
                <td>${profile.name}</td>
                <td>${account ? account.platform : 'N/A'}</td>
                <td>${formatCurrency(profile.price, profile.currency)}</td>
                <td><span class="status-badge ${profile.status}">${getStatusLabel(profile.status)}</span></td>
            </tr>
        `
    }).join('')
}

function renderAlerts(filter = 'all') {
    const container = document.getElementById('alertsList')
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    let alerts = profiles.map(profile => {
        const renewalDate = new Date(profile.renewal_date)
        let type = ''
        
        if (renewalDate < now) {
            type = 'expired'
        } else if (renewalDate <= nextWeek) {
            type = 'expiring'
        }
        
        const account = accounts.find(a => a.id === profile.account_id)
        
        return {
            profile,
            account,
            renewalDate,
            type
        }
    }).filter(a => a.type !== '')
    
    if (filter === 'expiring') {
        alerts = alerts.filter(a => a.type === 'expiring')
    } else if (filter === 'expired') {
        alerts = alerts.filter(a => a.type === 'expired')
    }
    
    if (alerts.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay alertas</p>'
        return
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-card ${alert.type}">
            <i class="fas ${alert.type === 'expired' ? 'fa-exclamation-circle' : 'fa-clock'}"></i>
            <div class="alert-info">
                <h3>${alert.profile.name}</h3>
                <p>${alert.account ? alert.account.platform : 'N/A'} - ${formatCurrency(alert.profile.price, alert.profile.currency)}/mes</p>
                ${alert.profile.profile_email ? `<p class="alert-email">${alert.profile.profile_email}</p>` : ''}
            </div>
            <span class="alert-date">
                ${alert.type === 'expired' ? 'Expiró' : 'Vence'} ${formatDate(alert.renewalDate)}
            </span>
        </div>
    `).join('')
}

function updateAlertBadge() {
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const alertCount = profiles.filter(profile => {
        const renewalDate = new Date(profile.renewal_date)
        return renewalDate <= nextWeek
    }).length
    
    document.getElementById('alertBadge').textContent = alertCount
    document.getElementById('alertBadge').style.display = alertCount > 0 ? 'block' : 'none'
}

function renderAll() {
    updateProfileStatuses()
    renderDashboard()
    renderAccounts()
    renderProfiles()
    renderIncome()
    renderAlerts()
    updateAlertBadge()
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function formatCurrency(amount, currencyCode = 'EUR') {
    const currency = currencies.find(c => c.code === currencyCode)
    if (!currency) return '€' + parseFloat(amount || 0).toFixed(2)
    return currency.symbol + parseFloat(amount || 0).toFixed(2)
}

function formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer')
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `
    
    container.appendChild(toast)
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse'
        setTimeout(() => toast.remove(), 300)
    }, 3000)
}

window.editAccount = editAccount
window.viewAccountProfiles = viewAccountProfiles
window.deleteAccountFn = deleteAccountFn
window.editProfile = editProfile
window.deleteProfileFn = deleteProfileFn

function exportData() {
    const data = {
        accounts: accounts,
        profiles: profiles,
        exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `streammanager_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showToast('Datos exportados correctamente', 'success')
}

async function importData(event) {
    const file = event.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result)
            
            if (data.accounts && Array.isArray(data.accounts)) {
                for (const account of data.accounts) {
                    await saveAccount(account)
                }
            }
            
            if (data.profiles && Array.isArray(data.profiles)) {
                for (const profile of data.profiles) {
                    await saveProfile(profile)
                }
            }
            
            showToast('Datos importados correctamente', 'success')
            renderAll()
        } catch (error) {
            console.error('Error importing data:', error)
            showToast('Error al importar datos', 'error')
        }
    }
    reader.readAsText(file)
    event.target.value = ''
}
