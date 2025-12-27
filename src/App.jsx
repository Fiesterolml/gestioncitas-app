import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, FileText, Search, ChevronRight, UserPlus, 
  Save, X, Trash2, Activity, Clock, LogOut, Lock, PlusCircle, 
  Download, Upload, Moon, Sun, Camera
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
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.Alta}`}>
      {status}
    </span>
  );
};

// --- VISTAS EXTERNAS ---

const DashboardView = ({ user, patients, appointments, setView }) => {
  const activeCount = patients.filter(p => p.status === 'Activo').length;
  const today = new Date().toISOString().split('T')[0];
  const upcomingAppts = appointments.filter(a => a.date >= today).slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Hola, {user.displayName}</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString()}</span>
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{p.diagnosis}</p>
              <div className="text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3 flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" /> {p.sessions?.length || 0} sesiones</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const PatientFormView = ({ formData, setFormData, handleSavePatient, setView }) => {
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Limite de seguridad: 500KB para evitar saturar Firestore
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
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diagnóstico</label>
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
         <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">Agendar Cita</h2>
         {activePatients.length === 0 ? (
           <div className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg mb-4 text-sm">
             ⚠️ No tienes pacientes "Activos" para agendar. Ve a la sección de Pacientes y crea uno nuevo o cambia el estado de uno existente.
           </div>
         ) : null}
         <form onSubmit={handleSaveAppointment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Paciente</label>
              <select required className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={apptFormData.patientId || ''} onChange={e => setApptFormData({...apptFormData, patientId: e.target.value})}>
                <option value="">Selecciona un paciente...</option>
                {activePatients.map(p => (
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
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nota (Opcional)</label>
              <input type="text" placeholder="Ej: Traer resultados, sesión online..." className="w-full p-3 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={apptFormData.note || ''} onChange={e => setApptFormData({...apptFormData, note: e.target.value})} />
            </div>
            <button type="submit" disabled={activePatients.length === 0} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">Confirmar Cita</button>
         </form>
       </Card>
    </div>
  );
};

const PatientDetailsView = ({ selectedPatient, patients, setView, setFormData, handleDelete, handleAddSession }) => {
  if (!selectedPatient) return null;
  const current = patients.find(p => p.id === selectedPatient.id) || selectedPatient;
  const [noteInput, setNoteInput] = useState("");
  
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
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
              <textarea className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-sm mb-2" rows="2" placeholder="Nota de evolución..." value={noteInput} onChange={e => setNoteInput(e.target.value)} />
              <button onClick={() => { handleAddSession(current.id, noteInput); setNoteInput(""); }} disabled={!noteInput.trim()} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">Guardar Nota</button>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px] space-y-4">
              {current.sessions?.map(s => (
                <div key={s.id} className="pl-4 border-l-2 border-slate-300 dark:border-slate-600">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{s.date}</div>
                  <p className="text-sm mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{s.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const CalendarView = ({ appointments, setApptFormData, setView, handleDelete }) => {
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
                 {groupedAppts[date].map(appt => (
                   <div key={appt.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                     <div className="flex gap-4">
                       <span className="font-mono text-slate-500 dark:text-slate-400 font-medium">{appt.time}</span>
                       <div>
                         <p className="font-bold text-slate-800 dark:text-white">{appt.patientName}</p>
                         {appt.note && <p className="text-sm text-slate-500 dark:text-slate-400">{appt.note}</p>}
                       </div>
                     </div>
                     <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => handleDelete('appointments', appt.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-2"><Trash2 className="w-4 h-4"/></button>
                     </div>
                   </div>
                 ))}
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
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [formData, setFormData] = useState({});
  const [apptFormData, setApptFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(!isConfigured);
  const fileInputRef = useRef(null);

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

        return () => { unsubPatients(); unsubAppts(); };
      } else {
        setPatients([]);
        setAppointments([]);
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
    const dataToExport = { exportedAt: new Date().toISOString(), user: user.email, patients, appointments };
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
          if (json.patients) {
            for (const p of json.patients) {
              const { id, ...data } = p;
              await setDoc(doc(db, 'users', user.uid, 'patients', id), { ...data, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
            }
          }
          if (json.appointments) {
            for (const a of json.appointments) {
              const { id, ...data } = a;
              await setDoc(doc(db, 'users', user.uid, 'appointments', id), { ...data, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
            }
          }
          alert("Importación completada.");
        }
      } catch (error) { console.error(error); alert("Error importando."); }
      finally { setLoading(false); if(fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsText(file);
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
        photo: formData.photo || null, // Guardamos la foto (base64) o null si no hay
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
        updatedAt: serverTimestamp() 
      };
      if (apptFormData.id) await updateDoc(doc(db, 'users', user.uid, 'appointments', apptFormData.id), data);
      else await addDoc(collection(db, 'users', user.uid, 'appointments'), { ...data, createdAt: serverTimestamp() });
      setView('calendar'); setApptFormData({});
    } catch (error) { console.error(error); alert("Error guardando cita: " + error.message); }
  };

  const handleDelete = async (collectionName, id) => {
    if (window.confirm("¿Estás seguro?")) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
        if (collectionName === 'patients' && selectedPatient?.id === id) setView('patients');
      } catch (error) { console.error(error); alert("Error al eliminar: " + error.message); }
    }
  };

  const handleAddSession = async (patientId, noteText) => {
    if (!noteText.trim()) return;
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    const newSession = { id: Date.now(), date: new Date().toISOString().split('T')[0], note: noteText };
    try { await updateDoc(doc(db, 'users', user.uid, 'patients', patientId), { sessions: [newSession, ...(patient.sessions || [])] }); }
    catch (error) { console.error(error); alert("Error al guardar nota: " + error.message); }
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
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xl"><Activity/> GestiónCitas</div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 dark:text-slate-400"><X/></button>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Users className="w-5 h-5"/> Panel</button>
          <button onClick={() => { setView('calendar'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'calendar' || view === 'appt-form' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Calendar className="w-5 h-5"/> Agenda</button>
          <button onClick={() => { setView('patients'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === 'patients' || view === 'details' || view === 'form' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><FileText className="w-5 h-5"/> Pacientes</button>
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
            {view === 'patients' && <PatientsListView patients={patients} searchTerm={searchTerm} setSearchTerm={setSearchTerm} setFormData={setFormData} setView={setView} setSelectedPatient={setSelectedPatient} />}
            {view === 'details' && <PatientDetailsView selectedPatient={selectedPatient} patients={patients} setView={setView} setFormData={setFormData} handleDelete={handleDelete} handleAddSession={handleAddSession} />}
            {view === 'form' && <PatientFormView formData={formData} setFormData={setFormData} handleSavePatient={handleSavePatient} setView={setView} />}
            {(view === 'calendar') && <CalendarView appointments={appointments} setApptFormData={setApptFormData} setView={setView} handleDelete={handleDelete} />}
            {(view === 'appt-form') && <ApptFormView setView={setView} handleSaveAppointment={handleSaveAppointment} apptFormData={apptFormData} setApptFormData={setApptFormData} patients={patients} />}
          </div>
        </div>
      </main>
    </div>
  );
}