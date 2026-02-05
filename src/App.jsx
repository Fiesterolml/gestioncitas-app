import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, FileText, Search, ChevronRight, UserPlus, 
  Save, X, Trash2, Activity, Clock, LogOut, Lock, PlusCircle, 
  Download, Upload, Moon, Sun, Camera, Edit2, Check, AlertTriangle,
  ExternalLink, List, Tag, MessageCircle, Phone, DollarSign, TrendingUp, BarChart3, PieChart
} from 'lucide-react';

// --- IMPORTANTE: Instala firebase primero: npm install firebase ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE (Tus credenciales) ---
const firebaseConfig = {
  apiKey: "AIzaSyCWMcQxF8ERx0ClExjFo6czkJjfQYx-GcQ",
  authDomain: "gestioncitas-app.firebaseapp.com",
  projectId: "gestioncitas-app",
  storageBucket: "gestioncitas-app.firebasestorage.app",
  messagingSenderId: "602853319594",
  appId: "1:602853319594:web:7871121292f9900e2981d3"
};

const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY_AQUI";

let auth, db;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Error inicializando Firebase:", e);
  }
}

// --- Componentes UI Reutilizables ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
    {children}
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    Activo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    "En Pausa": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Alta: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    // Estados de Pago
    Pagado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Pendiente: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.Alta}`}>
      {status}
    </span>
  );
};

// --- COMPONENTE MODAL DE CONFIRMACIÓN PERSONALIZADO ---
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 dark:border-slate-700 transform transition-all scale-100">
        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
        </div>
        <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm} 
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none text-sm font-medium transition-colors"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

// --- HELPER: GENERAR ARCHIVO .ICS (CALENDARIO NATIVO) ---
const downloadIcsFile = (appt) => {
  const start = new Date(`${appt.date}T${appt.time}`);
  const end = new Date(start.getTime() + 60 * 60 * 1000); 

  const formatLocal = (date) => {
    const pad = (n) => n < 10 ? '0' + n : n;
    return date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) + 'T' +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds());
  };

  const icsBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GestionCitas//App',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@gestioncitas`,
    `DTSTAMP:${formatLocal(new Date())}`,
    `DTSTART:${formatLocal(start)}`,
    `DTEND:${formatLocal(end)}`,
    `SUMMARY:Cita con ${appt.patientName}`,
    `DESCRIPTION:${appt.note || ''}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `cita_${appt.patientName.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- HELPER: GENERAR URL DE WHATSAPP ---
const getWhatsAppUrl = (appt, patients) => {
  const patient = patients.find(p => p.id === appt.patientId);
  if (!patient || !patient.phone) return null;

  let phone = patient.phone.replace(/\D/g, ''); 
  
  if (phone.length === 9) {
    phone = '51' + phone;
  }

  const message = `Hola ${patient.name}, le recordamos su cita para el día ${new Date(appt.date).toLocaleDateString('es-ES')} a las ${appt.time} hrs. ${appt.note ? `Nota: ${appt.note}` : ''}`;
  
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

// --- VISTAS EXTERNAS ---

const DashboardView = ({ user, patients, appointments, setView }) => {
  const activeCount = patients.filter(p => p.status === 'Activo').length;
  const today = new Date().toISOString().split('T')[0];
  const upcomingAppts = appointments.filter(a => a.date >= today).slice(0, 3);
  
  const lastSignInDate = user.metadata.lastSignInTime 
    ? new Date(user.metadata.lastSignInTime).toLocaleString('es-ES', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      }) 
    : 'Primer acceso';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Hola, {user.displayName}</h2>
          <div className="flex flex-col text-sm text-slate-500 dark:text-slate-400 mt-1">
            <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Último acceso: {lastSignInDate}</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-4 border-l-emerald-500 dark:border-l-emerald-500">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pacientes Activos</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{activeCount}</p>
        </Card>
        <Card className="p-6 border-l-4 border-l-blue-500 dark:border-l-blue-500">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Citas Programadas</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{appointments.filter(a => a.date >= today).length}</p>
        </Card>
         <Card className="p-6 border-l-4 border-l-violet-500 dark:border-l-violet-500">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Expedientes</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{patients.length}</p>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Próximas Citas</h3>
           <button onClick={() => setView('calendar')} className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">Ver calendario completo</button>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {upcomingAppts.length === 0 ? (
             <div className="p-6 text-center text-slate-400 text-sm">No hay citas próximas.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {upcomingAppts.map(appt => (
                <div key={appt.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg text-center min-w-[60px]">
                      <span className="block text-xs font-bold uppercase">{new Date(appt.date).toLocaleDateString('es-ES', {weekday: 'short'})}</span>
                      <span className="block text-lg font-bold">{new Date(appt.date).getDate()}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">{appt.patientName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3"/> {appt.time} hrs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FinanceDashboardView = ({ appointments }) => {
  const totalRevenue = appointments
    .filter(a => a.paymentStatus === 'Pagado')
    .reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);

  const pendingRevenue = appointments
    .filter(a => a.paymentStatus === 'Pendiente')
    .reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);

  const recentTransactions = [...appointments]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Panel Financiero</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border-l-4 border-l-green-500 dark:border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ingresos Totales (Pagados)</p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">S/ {totalRevenue.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full text-green-600 dark:text-green-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-l-4 border-l-orange-500 dark:border-l-orange-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pendiente de Cobro</p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">S/ {pendingRevenue.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-full text-orange-600 dark:text-orange-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Últimas Transacciones</h3>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Fecha</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Paciente</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Monto</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {recentTransactions.map(appt => (
                  <tr key={appt.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {new Date(appt.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-white">
                      {appt.patientName}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600 dark:text-slate-300">
                      S/ {(Number(appt.cost) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={appt.paymentStatus || 'Pendiente'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentTransactions.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">No hay transacciones registradas.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatsView = ({ appointments, patients, services }) => {
  // 1. Datos para Citas por Mes (Últimos 6 meses)
  const getLast6MonthsData = () => {
    const months = [];
    const data = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
      const monthName = d.toLocaleString('es-ES', { month: 'short' });
      
      const count = appointments.filter(a => a.date.startsWith(monthKey)).length;
      months.push(monthName);
      data.push(count);
    }
    return { months, data };
  };

  const { months, data: monthlyData } = getLast6MonthsData();
  const maxMonthly = Math.max(...monthlyData, 1);

  // 2. Datos para Servicios Top
  const getServiceStats = () => {
    const stats = {};
    // Inicializar con servicios existentes
    services.forEach(s => stats[s.name] = 0);
    // Contar pacientes
    patients.forEach(p => {
      if (p.serviceType) {
        stats[p.serviceType] = (stats[p.serviceType] || 0) + 1;
      }
    });
    // Convertir a array y ordenar
    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  };

  const serviceStats = getServiceStats();
  const maxService = Math.max(...serviceStats.map(s => s.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Estadísticas</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICA DE BARRAS: CITAS POR MES */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Citas por Mes
          </h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {monthlyData.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full relative flex items-end justify-center">
                  <div 
                    className="w-full max-w-[40px] bg-blue-500 dark:bg-blue-600 rounded-t-lg transition-all duration-500 group-hover:bg-blue-400 relative group"
                    style={{ height: `${(count / maxMonthly) * 200}px`, minHeight: '4px' }}
                  >
                     {/* Tooltip simple */}
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                       {count} citas
                     </div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">{months[i]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* GRÁFICA DE BARRAS HORIZONTALES: SERVICIOS */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-500" />
            Servicios Más Solicitados
          </h3>
          <div className="space-y-4">
            {serviceStats.length === 0 && <p className="text-slate-400 text-sm italic">No hay datos de servicios aún.</p>}
            {serviceStats.map((stat, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{stat.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{stat.count} pac.</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-purple-500 dark:bg-purple-600 h-2.5 rounded-full transition-all duration-1000" 
                    style={{ width: `${(stat.count / maxService) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      
      {/* Resumen Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
           <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">Activos</p>
           <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
             {patients.filter(p => p.status === 'Activo').length}
           </p>
         </div>
         <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
           <p className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase mb-1">En Pausa</p>
           <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
             {patients.filter(p => p.status === 'En Pausa').length}
           </p>
         </div>
         <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
           <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">De Alta</p>
           <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
             {patients.filter(p => p.status === 'Alta').length}
           </p>
         </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
           <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase mb-1">Total Citas</p>
           <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
             {appointments.length}
           </p>
         </div>
      </div>
    </div>
  );
};

const ServicesManagerView = ({ services, handleSaveService, handleDeleteService }) => {
  const [newService, setNewService] = useState("");

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Catálogo de Servicios</h2>
      
      <Card className="p-6">
        <div className="flex gap-4 mb-6">
          <input 
            type="text" 
            placeholder="Ej: Terapia de Pareja, Terapia Conductual..." 
            className="flex-1 p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
          />
          <button 
            onClick={() => { handleSaveService(newService); setNewService(""); }}
            disabled={!newService.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Agregar
          </button>
        </div>

        <div className="space-y-2">
          {services.length === 0 && <p className="text-slate-400 text-center py-4">No hay servicios registrados.</p>}
          {services.map(service => (
            <div key={service.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
              <span className="font-medium text-slate-700 dark:text-slate-300">{service.name}</span>
              <button 
                onClick={() => handleDeleteService(service.id)}
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"
              >
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const PatientsListView = ({ patients, searchTerm, setSearchTerm, setFormData, setView, setSelectedPatient }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Expedientes</h2>
        <button onClick={() => { setFormData({}); setView('form'); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"><UserPlus className="w-4 h-4" /> Nuevo Paciente</button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar paciente..." 
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
          <Card key={p.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer group">
            <div onClick={() => { setSelectedPatient(p); setView('details'); }}>
              <div className="flex justify-between mb-3">
                {/* FOTO O INICIAL */}
                {p.photo ? (
                  <img src={p.photo} alt={p.name} className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-600" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-lg">
                    {p.name?.charAt(0)}
                  </div>
                )}
                <Badge status={p.status} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">{p.name}</h3>
              
              {/* DATOS CLAVE VISIBLES EN TARJETA */}
              <div className="space-y-1 mt-2 mb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{p.serviceType || "Sin asignar"}</span>
                </div>
                {p.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{p.phone}</span>
                  </div>
                )}
              </div>

              <div className="text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3 flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" /> {p.sessions?.length || 0} sesiones</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const PatientFormView = ({ formData, setFormData, handleSavePatient, setView, services }) => {
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) {
        alert("La imagen es demasiado grande. Por favor usa una imagen menor a 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <button onClick={() => setView('patients')} className="mb-4 text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"><ChevronRight className="w-4 h-4 rotate-180"/> Cancelar</button>
      <Card className="p-8">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">{formData.id ? 'Editar' : 'Nuevo'} Paciente</h2>
        <form onSubmit={handleSavePatient} className="space-y-4">
          
          {/* SECCIÓN DE FOTO */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Foto de Perfil</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-slate-500 dark:text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-xs file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  dark:file:bg-slate-700 dark:file:text-slate-200
                "
              />
              <p className="text-xs text-slate-400 mt-1">Máx. 500KB (Formato JPG, PNG)</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
            <input required className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Edad</label>
              <input type="number" className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.age || ''} onChange={e => setFormData({...formData, age: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input 
                type="tel" 
                placeholder="Solo números"
                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" 
                value={formData.phone || ''} 
                onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} 
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input type="email" className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          
          {/* NUEVO SELECTOR DE TIPO DE SERVICIO */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Servicio / Terapia</label>
            <select 
              className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              value={formData.serviceType || ''}
              onChange={e => setFormData({...formData, serviceType: e.target.value})}
            >
              <option value="">-- Seleccionar Servicio --</option>
              {services.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diagnóstico (Detalle)</label>
            <input className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.diagnosis || ''} onChange={e => setFormData({...formData, diagnosis: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado</label>
            <select className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.status || 'Activo'} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="Activo">Activo</option>
              <option value="En Pausa">En Pausa</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">Guardar Expediente</button>
        </form>
      </Card>
    </div>
  );
};

const ApptFormView = ({ setView, handleSaveAppointment, apptFormData, setApptFormData, patients }) => {
  const activePatients = patients.filter(p => p.status === 'Activo');
  
  return (
    <div className="max-w-xl mx-auto animate-fade-in">
       <button onClick={() => setView('calendar')} className="mb-4 text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"><ChevronRight className="w-4 h-4 rotate-180"/> Cancelar</button>
       <Card className="p-8">
         <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">
           {apptFormData.id ? 'Editar Cita' : 'Agendar Cita'}
         </h2>
         {activePatients.length === 0 && !apptFormData.id ? (
           <div className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg mb-4 text-sm">
             ⚠️ No tienes pacientes "Activos" para agendar. Ve a la sección de Pacientes y crea uno nuevo o cambia el estado de uno existente.
           </div>
         ) : null}
         <form onSubmit={handleSaveAppointment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Paciente</label>
              <select required className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={apptFormData.patientId || ''} onChange={e => setApptFormData({...apptFormData, patientId: e.target.value})}>
                <option value="">Selecciona un paciente...</option>
                {/* Mostrar todos los pacientes si estamos editando, o solo activos si es nueva */}
                {(apptFormData.id ? patients : activePatients).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                <input required type="date" className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={apptFormData.date || ''} onChange={e => setApptFormData({...apptFormData, date: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora</label>
                <input required type="time" className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={apptFormData.time || ''} onChange={e => setApptFormData({...apptFormData, time: e.target.value})} />
              </div>
            </div>
            
            {/* SECCIÓN FINANCIERA */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Costo de Sesión (S/)</label>
                <input 
                  type="number" 
                  min="0"
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" 
                  value={apptFormData.cost || ''} 
                  onChange={e => setApptFormData({...apptFormData, cost: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado del Pago</label>
                <select 
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" 
                  value={apptFormData.paymentStatus || 'Pendiente'} 
                  onChange={e => setApptFormData({...apptFormData, paymentStatus: e.target.value})}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Pagado">Pagado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nota (Opcional)</label>
              <input type="text" placeholder="Ej: Traer resultados, sesión online..." className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={apptFormData.note || ''} onChange={e => setApptFormData({...apptFormData, note: e.target.value})} />
            </div>
            <button type="submit" disabled={!apptFormData.id && activePatients.length === 0} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
              {apptFormData.id ? 'Guardar Cambios' : 'Confirmar Cita'}
            </button>
         </form>
       </Card>
    </div>
  );
};

const PatientDetailsView = ({ selectedPatient, patients, setView, setFormData, handleDelete, handleAddSession, handleUpdateSession, handleDeleteSession }) => {
  if (!selectedPatient) return null;
  const current = patients.find(p => p.id === selectedPatient.id) || selectedPatient;
  const [noteInput, setNoteInput] = useState("");
  const [editingSession, setEditingSession] = useState(null); 
  
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <button onClick={() => setView('patients')} className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"><ChevronRight className="w-4 h-4 rotate-180"/> Volver</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 text-center">
             <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3 overflow-hidden border border-slate-200 dark:border-slate-600">
               {current.photo ? (
                 <img src={current.photo} alt={current.name} className="w-full h-full object-cover" />
               ) : (
                 current.name?.charAt(0)
               )}
             </div>
             <h2 className="text-xl font-bold text-slate-800 dark:text-white">{current.name}</h2>
             <div className="mt-2"><Badge status={current.status} /></div>
             <div className="space-y-4 text-sm mt-6 text-left text-slate-600 dark:text-slate-300">
               <div><label className="text-xs font-bold text-slate-400 uppercase">Servicio / Terapia</label><p className="font-medium text-slate-800 dark:text-white">{current.serviceType || "No asignado"}</p></div>
               <div><label className="text-xs font-bold text-slate-400 uppercase">Diagnóstico</label><p className="font-medium text-slate-800 dark:text-white">{current.diagnosis}</p></div>
               <div><label className="text-xs font-bold text-slate-400 uppercase">Contacto</label><p>{current.email}</p><p>{current.phone}</p></div>
             </div>
             <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
               <button onClick={() => { setFormData(current); setView('form'); }} className="py-2 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-600 dark:text-slate-300">Editar Datos</button>
               <button onClick={() => handleDelete('patients', current.id)} className="py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm">Eliminar Expediente</button>
             </div>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="p-6 h-full flex flex-col">
            <h3 className="font-bold mb-4 flex gap-2 text-slate-800 dark:text-white"><FileText className="w-5 h-5"/> Historial Clínico</h3>
            
            {/* Input Nueva Nota */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
              <textarea className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-sm mb-2" rows="2" placeholder="Nota de evolución..." value={noteInput} onChange={e => setNoteInput(e.target.value)} />
              <button onClick={() => { handleAddSession(current.id, noteInput); setNoteInput(""); }} disabled={!noteInput.trim()} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">Guardar Nota</button>
            </div>

            {/* Lista de Notas */}
            <div className="flex-1 overflow-y-auto max-h-[400px] space-y-6 pr-2">
              {current.sessions?.length === 0 && <div className="text-center text-slate-400 py-4 italic">Sin notas registradas</div>}
              {current.sessions?.map(s => (
                <div key={s.id} className="relative pl-6 border-l-2 border-slate-300 dark:border-slate-600 group">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-500"></div>
                  
                  {editingSession?.id === s.id ? (
                    <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3 shadow-sm">
                      <textarea 
                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-transparent text-sm mb-2 dark:text-white"
                        value={editingSession.text}
                        onChange={(e) => setEditingSession({...editingSession, text: e.target.value})}
                        rows="3"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setEditingSession(null)} 
                          className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => { handleUpdateSession(current.id, s.id, editingSession.text); setEditingSession(null); }}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3"/> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{s.date}</div>
                        
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingSession({id: s.id, text: s.note})}
                            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="Editar nota"
                          >
                            <Edit2 className="w-3 h-3"/>
                          </button>
                          <button 
                            onClick={() => handleDeleteSession(current.id, s.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Eliminar nota"
                          >
                            <Trash2 className="w-3 h-3"/>
                          </button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{s.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const CalendarView = ({ appointments, setApptFormData, setView, handleDelete, patients, onEdit }) => {
  const groupedAppts = appointments.reduce((acc, appt) => {
    if (!acc[appt.date]) acc[appt.date] = [];
    acc[appt.date].push(appt);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedAppts).sort();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Agenda de Citas</h2>
        <button onClick={() => { setApptFormData({ date: today }); setView('appt-form'); }} className="btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <PlusCircle className="w-4 h-4" /> Nueva Cita
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {sortedDates.length === 0 && <div className="text-center py-12 text-slate-400">No hay citas programadas.</div>}
          {sortedDates.map(date => (
            <div key={date} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
               <div className={`px-4 py-2 text-sm font-bold border-b border-slate-100 dark:border-slate-700 ${date === today ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300'}`}>
                 {new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                 {date === today && " (Hoy)"}
               </div>
               <div className="divide-y divide-slate-100 dark:divide-slate-700">
                 {groupedAppts[date].map(appt => {
                   const waLink = getWhatsAppUrl(appt, patients);
                   const isPaid = appt.paymentStatus === 'Pagado';
                   
                   return (
                   <div key={appt.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                     <div className="flex gap-4">
                       <span className="font-mono text-slate-500 dark:text-slate-400 font-medium">{appt.time}</span>
                       <div>
                         <div className="flex items-center gap-2">
                           <p className="font-bold text-slate-800 dark:text-white">{appt.patientName}</p>
                           {/* INDICADOR DE PAGO */}
                           {appt.cost > 0 && (
                             <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isPaid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                               {isPaid ? 'S/' : 'S/⏳'}
                             </span>
                           )}
                         </div>
                         {appt.note && <p className="text-sm text-slate-500 dark:text-slate-400">{appt.note}</p>}
                       </div>
                     </div>
                     <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       {/* BOTÓN WHATSAPP */}
                       {waLink && (
                         <a 
                           href={waLink} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 p-2"
                           title="Enviar recordatorio por WhatsApp"
                         >
                           <MessageCircle className="w-4 h-4"/>
                         </a>
                       )}
                       {/* BOTÓN GOOGLE CALENDAR */}
                       <button
                         onClick={() => downloadIcsFile(appt)} 
                         className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 p-2"
                         title="Agregar a Google Calendar"
                       >
                         <Calendar className="w-4 h-4"/>
                       </button>
                       {/* BOTÓN EDITAR */}
                       <button 
                         onClick={() => onEdit(appt)} 
                         className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 p-2"
                         title="Editar cita"
                       >
                         <Edit2 className="w-4 h-4"/>
                       </button>
                       <button onClick={() => handleDelete('appointments', appt.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-2"><Trash2 className="w-4 h-4"/></button>
                     </div>
                   </div>
                 )})}
               </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block">
          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30 sticky top-4">
            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Resumen</h3>
            <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">Tienes {appointments.length} citas en total.</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- Componente Principal APP ---

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]); // NUEVO ESTADO PARA SERVICIOS
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [formData, setFormData] = useState({});
  const [apptFormData, setApptFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(!isConfigured);
  const fileInputRef = useRef(null);
  
  // --- Estado para el Modal de Confirmación ---
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const closeModal = () => setConfirmModal({ ...confirmModal, isOpen: false });

  // --- Estado para Modo Oscuro ---
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    document.title = "GestiónCitas";
  }, []);

  useEffect(() => {
    if (!isConfigured || !auth) {
      setConfigError(true);
      setLoading(false);
      return;
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const qPatients = query(collection(db, 'users', currentUser.uid, 'patients'), orderBy('createdAt', 'desc'));
        const unsubPatients = onSnapshot(qPatients, (snapshot) => {
          setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error pacientes:", error));

        const qAppts = query(collection(db, 'users', currentUser.uid, 'appointments'), orderBy('date', 'asc'));
        const unsubAppts = onSnapshot(qAppts, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => a.time.localeCompare(b.time));
          setAppointments(data);
          setLoading(false);
        }, (error) => {
          console.error("Error citas:", error);
          setLoading(false);
        });

        // NUEVO: Suscripción a Servicios
        const qServices = query(collection(db, 'users', currentUser.uid, 'services'), orderBy('createdAt', 'asc'));
        const unsubServices = onSnapshot(qServices, (snapshot) => {
          setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubPatients(); unsubAppts(); unsubServices(); };
      } else {
        setPatients([]);
        setAppointments([]);
        setServices([]);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (error) { console.error("Login error:", error); alert("Error al iniciar sesión: " + error.message); }
  };

  const handleExportData = () => {
    if (!patients.length && !appointments.length) { alert("No hay datos para exportar."); return; }
    const dataToExport = { exportedAt: new Date().toISOString(), user: user.email, patients, appointments, services };
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gestioncitas_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.patients && !json.appointments) { alert("El archivo no es válido."); return; }
        if (window.confirm(`Importar ${json.patients?.length || 0} pacientes y ${json.appointments?.length || 0} citas?`)) {
          setLoading(true);
          // Importar pacientes
          if (json.patients) {
            for (const p of json.patients) {
              const { id, ...data } = p;
              await setDoc(doc(db, 'users', user.uid, 'patients', id), { ...data, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
            }
          }
          // Importar citas
          if (json.appointments) {
            for (const a of json.appointments) {
              const { id, ...data } = a;
              await setDoc(doc(db, 'users', user.uid, 'appointments', id), { ...data, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
            }
          }
          // Importar servicios (NUEVO)
          if (json.services) {
            for (const s of json.services) {
              const { id, ...data } = s;
              await setDoc(doc(db, 'users', user.uid, 'services', id), { ...data, createdAt: serverTimestamp() });
            }
          }
          alert("Importación completada.");
        }
      } catch (error) { console.error(error); alert("Error importando."); }
      finally { setLoading(false); if(fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  // --- LOGICA DE SERVICIOS ---
  const handleSaveService = async (serviceName) => {
    if (!serviceName.trim()) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'services'), {
        name: serviceName.trim(),
        createdAt: serverTimestamp()
      });
    } catch (error) { console.error(error); alert("Error guardando servicio: " + error.message); }
  };

  const handleDeleteService = async (id) => {
    if(window.confirm("¿Eliminar este servicio?")) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'services', id));
      } catch (error) { console.error(error); alert("Error eliminando servicio: " + error.message); }
    }
  };

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const patientData = {
        name: formData.name || '',
        age: formData.age || '',
        phone: formData.phone || '',
        email: formData.email || '',
        diagnosis: formData.diagnosis || '',
        status: formData.status || 'Activo',
        serviceType: formData.serviceType || '', // NUEVO CAMPO
        photo: formData.photo || null,
        updatedAt: serverTimestamp()
      };

      if (formData.id) {
        await updateDoc(doc(db, 'users', user.uid, 'patients', formData.id), patientData);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'patients'), {
          ...patientData,
          sessions: [],
          startDate: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp()
        });
      }
      setView('patients'); setFormData({});
    } catch (error) { console.error(error); alert("Error guardando paciente: " + error.message); }
  };

  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const patient = patients.find(p => p.id === apptFormData.patientId);
      if (!patient) { alert("Error: Paciente no encontrado."); return; }
      const data = { 
        patientId: apptFormData.patientId, 
        patientName: patient.name || 'Desconocido', 
        date: apptFormData.date, 
        time: apptFormData.time, 
        note: apptFormData.note || '', 
        cost: Number(apptFormData.cost) || 0,
        paymentStatus: apptFormData.paymentStatus || 'Pendiente',
        updatedAt: serverTimestamp() 
      };
      if (apptFormData.id) await updateDoc(doc(db, 'users', user.uid, 'appointments', apptFormData.id), data);
      else await addDoc(collection(db, 'users', user.uid, 'appointments'), { ...data, createdAt: serverTimestamp() });
      setView('calendar'); setApptFormData({});
    } catch (error) { console.error(error); alert("Error guardando cita: " + error.message); }
  };

  const handleEditAppointment = (appt) => {
    setApptFormData(appt);
    setView('appt-form');
  };

  // --- ELIMINAR CON MODAL ---
  const handleDelete = (collectionName, id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Registro',
      message: `¿Estás seguro de eliminar este elemento de ${collectionName === 'patients' ? 'pacientes' : 'citas'}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
          if (collectionName === 'patients' && selectedPatient?.id === id) setView('patients');
          closeModal();
        } catch (error) { console.error(error); alert("Error al eliminar: " + error.message); }
      }
    });
  };

  const handleAddSession = async (patientId, noteText) => {
    if (!noteText.trim()) return;
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    const newSession = { id: Date.now(), date: new Date().toISOString().split('T')[0], note: noteText };
    try { await updateDoc(doc(db, 'users', user.uid, 'patients', patientId), { sessions: [newSession, ...(patient.sessions || [])] }); }
    catch (error) { console.error(error); alert("Error al guardar nota: " + error.message); }
  };

  const handleUpdateSession = async (patientId, sessionId, newText) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    const updatedSessions = patient.sessions.map(s => s.id === sessionId ? { ...s, note: newText } : s);
    try { await updateDoc(doc(db, 'users', user.uid, 'patients', patientId), { sessions: updatedSessions }); }
    catch (error) { console.error(error); alert("Error al actualizar nota: " + error.message); }
  };

  const handleDeleteSession = (patientId, sessionId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Nota',
      message: '¿Estás seguro de eliminar esta nota del historial? No se puede recuperar.',
      onConfirm: async () => {
        const patient = patients.find(p => p.id === patientId);
        if (!patient) return;
        const updatedSessions = patient.sessions.filter(s => s.id !== sessionId);
        try {
          await updateDoc(doc(db, 'users', user.uid, 'patients', patientId), { sessions: updatedSessions });
          closeModal();
        } catch (error) { console.error(error); alert("Error al eliminar nota: " + error.message); }
      }
    });
  };

  if (configError) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4"><Card className="max-w-md w-full p-8 text-center border-l-4 border-l-amber-500"><Activity className="w-12 h-12 text-amber-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Configuración Necesaria</h2><p className="text-slate-600 dark:text-slate-300 mb-6">Configura tus credenciales de Firebase en App.jsx</p></Card></div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div></div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Activity className="w-8 h-8 text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">GestiónCitas</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Gestión profesional de pacientes y agenda.</p>
        <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 border dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 py-3 rounded-xl transition-all shadow-sm text-slate-700 dark:text-white font-medium"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" /><span>Entrar con Google</span></button>
      </Card>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onCancel={closeModal} 
      />
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xl"><Activity/> GestiónCitas</div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 dark:text-slate-400"><X/></button>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Users className="w-5 h-5"/> Panel</button>
          <button onClick={() => { setView('calendar'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'calendar' || view === 'appt-form' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Calendar className="w-5 h-5"/> Agenda</button>
          <button onClick={() => { setView('patients'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'patients' || view === 'details' || view === 'form' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><FileText className="w-5 h-5"/> Pacientes</button>
          <button onClick={() => { setView('services'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'services' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><List className="w-5 h-5"/> Servicios</button>
          <button onClick={() => { setView('finance'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'finance' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><DollarSign className="w-5 h-5"/> Finanzas</button>
          <button onClick={() => { setView('stats'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'stats' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><BarChart3 className="w-5 h-5"/> Estadísticas</button>
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {/* Botón de Modo Oscuro */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 w-full p-3 rounded-xl transition-colors font-medium text-sm"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Modo Claro' : 'Modo Oscuro'}
          </button>

          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
          <button onClick={handleExportData} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 w-full p-3 rounded-xl transition-colors font-medium text-sm"><Download className="w-4 h-4"/> Exportar Datos</button>
          <button onClick={handleImportClick} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 w-full p-3 rounded-xl transition-colors font-medium text-sm"><Upload className="w-4 h-4"/> Importar Datos</button>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-full p-3 rounded-xl transition-colors font-medium text-sm border-t border-slate-100 dark:border-slate-800 mt-2 pt-4"><LogOut className="w-4 h-4"/> Salir</button>
        </div>
      </div>
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
        <div className="md:hidden p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
           <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 dark:text-slate-400"><Users/></button>
           <span className="font-bold text-slate-800 dark:text-white">GestiónCitas</span>
           <div className="w-6"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {view === 'dashboard' && <DashboardView user={user} patients={patients} appointments={appointments} setView={setView} />}
            {view === 'finance' && <FinanceDashboardView appointments={appointments} />}
            {view === 'stats' && <StatsView appointments={appointments} patients={patients} services={services} />}
            {view === 'patients' && <PatientsListView patients={patients} searchTerm={searchTerm} setSearchTerm={setSearchTerm} setFormData={setFormData} setView={setView} setSelectedPatient={setSelectedPatient} />}
            {view === 'details' && <PatientDetailsView 
              selectedPatient={selectedPatient} 
              patients={patients} 
              setView={setView} 
              setFormData={setFormData} 
              handleDelete={handleDelete} 
              handleAddSession={handleAddSession}
              handleUpdateSession={handleUpdateSession} 
              handleDeleteSession={handleDeleteSession} 
            />}
            {view === 'form' && <PatientFormView formData={formData} setFormData={setFormData} handleSavePatient={handleSavePatient} setView={setView} services={services} />}
            {view === 'services' && <ServicesManagerView services={services} handleSaveService={handleSaveService} handleDeleteService={handleDeleteService} />}
            {(view === 'calendar') && <CalendarView appointments={appointments} setApptFormData={setApptFormData} setView={setView} handleDelete={handleDelete} patients={patients} onEdit={handleEditAppointment} />}
            {(view === 'appt-form') && <ApptFormView setView={setView} handleSaveAppointment={handleSaveAppointment} apptFormData={apptFormData} setApptFormData={setApptFormData} patients={patients} />}
          </div>
        </div>
      </main>
    </div>
  );
}