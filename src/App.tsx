import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  Timestamp,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut 
} from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { Client, Expense, MiscExpense, CashAdjustment } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, LogOut, User as UserIcon, MapPin, Phone, DollarSign, Trash2, Info, ArrowLeft, ArrowRight, TrendingUp, Users, Receipt, History, Wallet, CreditCard, Banknote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'dashboard' | 'clientes' | 'deudas' | 'historial' | 'gastos-varios';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-harmony-red/50 bg-card">
            <CardHeader>
              <CardTitle className="text-harmony-red flex items-center gap-2">
                <Info className="h-5 w-5" /> Algo salió mal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Se ha producido un error inesperado. Por favor, intenta recargar la página.
              </p>
              <div className="p-3 bg-secondary rounded-lg overflow-auto max-h-40">
                <code className="text-[10px] text-foreground block whitespace-pre-wrap">
                  {this.state.error?.message}
                </code>
              </div>
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full bg-mamei hover:bg-mamei/90"
              >
                Recargar Aplicación
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [miscExpenses, setMiscExpenses] = useState<MiscExpense[]>([]);
  const [cashAdjustments, setCashAdjustments] = useState<CashAdjustment[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddMiscExpenseOpen, setIsAddMiscExpenseOpen] = useState(false);
  const [isAddCashOpen, setIsAddCashOpen] = useState(false);
  const [isAddAdvanceOpen, setIsAddAdvanceOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [newCash, setNewCash] = useState({ amount: '', reason: '' });
  const [newAdvance, setNewAdvance] = useState({ amount: '', voucherUrl: '' });

  // Form states
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    location: '',
    totalAmount: '',
    advanceAmount: '',
    progressPercentage: '',
    currentWork: '',
    voucherUrl: ''
  });

  const [newExpense, setNewExpense] = useState({
    store: '',
    detail: '',
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'card'
  });

  const [newMiscExpense, setNewMiscExpense] = useState({
    store: '',
    detail: '',
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'card'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch Clients
    const clientsQuery = query(
      collection(db, 'clients'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientsData);
    });

    // Fetch Misc Expenses
    const miscQuery = query(
      collection(db, 'miscExpenses'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeMisc = onSnapshot(miscQuery, (snapshot) => {
      const miscData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MiscExpense[];
      setMiscExpenses(miscData);
    });

    // Fetch Cash Adjustments
    const cashQuery = query(
      collection(db, 'cashAdjustments'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeCash = onSnapshot(cashQuery, (snapshot) => {
      const cashData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CashAdjustment[];
      setCashAdjustments(cashData);
    });

    return () => {
      unsubscribeClients();
      unsubscribeMisc();
      unsubscribeCash();
    };
  }, []);

  useEffect(() => {
    if (!selectedClient) {
      setExpenses([]);
      return;
    }

    const q = query(
      collection(db, 'clients', selectedClient.id, 'expenses'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(expensesData);
    }, (error) => {
      console.error("Error fetching expenses:", error);
    });

    return () => unsubscribe();
  }, [selectedClient]);

  const handleLogout = () => signOut(auth);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const initialAdvanceAmount = Number(newClient.advanceAmount);
      const path = 'clients';
      const clientData: any = {
        ...newClient,
        totalAmount: Number(newClient.totalAmount),
        advanceAmount: initialAdvanceAmount,
        progressPercentage: Number(newClient.progressPercentage) || 0,
        status: 'active',
        createdAt: Timestamp.now()
      };

      if (user?.uid) {
        clientData.ownerId = user.uid;
      }

      const clientRef = await addDoc(collection(db, path), clientData);

      // Add initial advance to history
      if (initialAdvanceAmount > 0) {
        await addDoc(collection(db, 'clients', clientRef.id, 'advances'), {
          amount: initialAdvanceAmount,
          voucherUrl: newClient.voucherUrl,
          createdAt: Timestamp.now(),
          reason: 'Avance Inicial'
        });
      }

      setIsAddClientOpen(false);
      setNewClient({
        name: '',
        phone: '',
        location: '',
        totalAmount: '',
        advanceAmount: '',
        progressPercentage: '',
        currentWork: '',
        voucherUrl: ''
      });
    } catch (error) {
      throw handleFirestoreError(error, OperationType.CREATE, 'clients');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const expenseAmount = Number(newExpense.amount);
      if (isNaN(expenseAmount) || expenseAmount <= 0) {
        alert('Por favor ingrese un monto válido');
        return;
      }
      
      const path = `clients/${selectedClient.id}/expenses`;
      // Add expense
      await addDoc(collection(db, 'clients', selectedClient.id, 'expenses'), {
        ...newExpense,
        amount: expenseAmount,
        clientId: selectedClient.id,
        createdAt: Timestamp.now()
      });

      // Update client advance
      const newAdvance = selectedClient.advanceAmount - expenseAmount;
      await updateDoc(doc(db, 'clients', selectedClient.id), {
        advanceAmount: newAdvance
      });

      // Update local selected client state to reflect change immediately
      setSelectedClient({
        ...selectedClient,
        advanceAmount: newAdvance
      });

      setIsAddExpenseOpen(false);
      setNewExpense({ store: '', detail: '', amount: '', paymentMethod: 'cash' });
    } catch (error) {
      throw handleFirestoreError(error, OperationType.CREATE, `clients/${selectedClient.id}/expenses`);
    }
  };

  const APP_PASSWORD = (import.meta as any).env.VITE_APP_PASSWORD || '1989';

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (password !== APP_PASSWORD) {
      alert('Contraseña incorrecta');
      return;
    }

    try {
      const amount = Number(newAdvance.amount);
      const data: any = {
        amount,
        voucherUrl: newAdvance.voucherUrl,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'clients', selectedClient.id, 'advances'), data);

      const newTotalAdvance = selectedClient.advanceAmount + amount;
      await updateDoc(doc(db, 'clients', selectedClient.id), {
        advanceAmount: newTotalAdvance
      });

      setSelectedClient({
        ...selectedClient,
        advanceAmount: newTotalAdvance
      });

      setIsAddAdvanceOpen(false);
      setNewAdvance({ amount: '', voucherUrl: '' });
      setPassword('');
    } catch (error) {
      throw handleFirestoreError(error, OperationType.CREATE, `clients/${selectedClient.id}/advances`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'client' | 'advance') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'client') {
          setNewClient({ ...newClient, voucherUrl: reader.result as string });
        } else {
          setNewAdvance({ ...newAdvance, voucherUrl: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMiscExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const amount = Number(newMiscExpense.amount);
      if (isNaN(amount) || amount <= 0) {
        alert('Por favor ingrese un monto válido');
        return;
      }

      const expenseData: any = {
        ...newMiscExpense,
        amount: amount,
        createdAt: Timestamp.now()
      };

      if (user?.uid) {
        expenseData.ownerId = user.uid;
      }

      await addDoc(collection(db, 'miscExpenses'), expenseData);
      setIsAddMiscExpenseOpen(false);
      setNewMiscExpense({ store: '', detail: '', amount: '', paymentMethod: 'cash' });
    } catch (error) {
      throw handleFirestoreError(error, OperationType.CREATE, 'miscExpenses');
    }
  };

  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== APP_PASSWORD) {
      alert('Contraseña incorrecta');
      return;
    }

    try {
      const data: any = {
        amount: Number(newCash.amount),
        reason: newCash.reason,
        createdAt: Timestamp.now()
      };

      if (user?.uid) {
        data.ownerId = user.uid;
      }

      await addDoc(collection(db, 'cashAdjustments'), data);
      setIsAddCashOpen(false);
      setNewCash({ amount: '', reason: '' });
      setPassword('');
    } catch (error) {
      throw handleFirestoreError(error, OperationType.CREATE, 'cashAdjustments');
    }
  };

  const handleDeleteMiscExpense = async (id: string) => {
    if (prompt('Ingrese contraseña:') !== APP_PASSWORD) {
      alert('Contraseña incorrecta');
      return;
    }
    try {
      await deleteDoc(doc(db, 'miscExpenses', id));
    } catch (error) {
      console.error("Error deleting misc expense:", error);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (prompt('Ingrese contraseña:') !== APP_PASSWORD) {
      alert('Contraseña incorrecta');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
    try {
      await deleteDoc(doc(db, 'clients', id));
      if (selectedClient?.id === id) setSelectedClient(null);
    } catch (error) {
      console.error("Error deleting client:", error);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!selectedClient) return;
    if (prompt('Ingrese contraseña:') !== APP_PASSWORD) {
      alert('Contraseña incorrecta');
      return;
    }
    try {
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) return;

      await deleteDoc(doc(db, 'clients', selectedClient.id, 'expenses', expenseId));
      
      // Return the amount to the client advance
      const newAdvance = selectedClient.advanceAmount + expense.amount;
      await updateDoc(doc(db, 'clients', selectedClient.id), {
        advanceAmount: newAdvance
      });

      setSelectedClient({
        ...selectedClient,
        advanceAmount: newAdvance
      });
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  const handleFinishWork = async (clientId: string) => {
    if (!confirm('¿Marcar este trabajo como terminado? Se moverá al historial.')) return;
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        status: 'finished',
        progressPercentage: 100
      });
      setSelectedClient(null);
      setActiveTab('historial');
    } catch (error) {
      console.error("Error finishing work:", error);
    }
  };

  const getStatusColor = (advance: number, total: number) => {
    const ratio = advance / total;
    if (ratio > 0.5) return 'bg-harmony-blue';
    if (ratio > 0.2) return 'bg-mamei';
    return 'bg-harmony-red';
  };

  const getStatusBadge = (advance: number, total: number) => {
    const ratio = advance / total;
    if (ratio > 0.5) return <Badge className="bg-harmony-blue/20 text-harmony-blue border-harmony-blue/30">Estable</Badge>;
    if (ratio > 0.2) return <Badge className="bg-mamei/20 text-mamei border-mamei/30">Atención</Badge>;
    return <Badge className="bg-harmony-red/20 text-harmony-red border-harmony-red/30">Crítico</Badge>;
  };

  const renderClients = (filteredClients: Client[]) => (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {filteredClients.map(client => (
        <motion.div key={client.id} layoutId={client.id}>
          <Card 
            className="group relative cursor-pointer overflow-hidden border border-border bg-card shadow-lg shadow-black/20 transition-all hover:shadow-2xl hover:shadow-mamei/10 hover:-translate-y-1"
            onClick={() => setSelectedClient(client)}
          >
            <div className="h-1.5 w-full bg-secondary overflow-hidden">
              <div 
                className={`h-full ${getStatusColor(client.advanceAmount, client.totalAmount)} transition-all duration-500`} 
                style={{ width: `${Math.min(100, (client.advanceAmount / client.totalAmount) * 100)}%` }}
              />
            </div>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-xl font-black tracking-tight text-foreground group-hover:text-mamei transition-colors">{client.name}</CardTitle>
                <div className="px-2 py-1 rounded-full bg-secondary text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {client.progressPercentage}% Obra
                </div>
              </div>
              <CardDescription className="flex items-center gap-1 font-medium text-muted-foreground">
                <MapPin className="h-3 w-3 text-mamei" /> {client.location || 'Sin ubicación'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Presupuesto Disp.</p>
                  <p className="text-xl font-black text-foreground">${client.advanceAmount.toLocaleString()}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center group-hover:bg-mamei/10 transition-colors">
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-mamei transition-colors" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Info className="h-3 w-3" /> {client.currentWork || 'Sin detalles'}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-harmony-red opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClient(client.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );

  const INITIAL_CASH = 40650;
  const totalAdjustments = cashAdjustments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalCashExpenses = miscExpenses.filter(m => m.paymentMethod === 'cash').reduce((acc, m) => acc + m.amount, 0);
  const totalClientAdvances = clients.filter(c => !c.status || c.status === 'active').reduce((acc, c) => acc + c.advanceAmount, 0);
  const availableCash = INITIAL_CASH + totalAdjustments + totalClientAdvances - totalCashExpenses;

  const activeClients = clients.filter(c => !c.status || c.status === 'active');
  const finishedClients = clients.filter(c => c.status === 'finished');
  const totalRevenue = clients.reduce((acc, c) => acc + c.totalAmount, 0);
  const totalCollected = clients.reduce((acc, c) => acc + c.advanceAmount, 0);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24 md:pb-0">
      {/* Sidebar for Desktop / Header for all */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1.5 bg-mamei rounded-full" />
              <h1 className="text-xl font-black tracking-tighter text-foreground hidden sm:block">
                HARMONY <span className="text-mamei">GLASS</span>
              </h1>
              <h1 className="text-xl font-black tracking-tighter text-foreground sm:hidden">
                H<span className="text-mamei">G</span>
              </h1>
            </div>
            
            <nav className="hidden lg:flex items-center gap-1 ml-8">
               {[
                { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                { id: 'clientes', label: 'Proyectos', icon: Users },
                { id: 'gastos-varios', label: 'Caja', icon: Banknote },
                { id: 'historial', label: 'Historial', icon: History }
              ].map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? 'secondary' : 'ghost'}
                  className={`rounded-full px-4 ${activeTab === item.id ? 'bg-mamei/10 text-mamei font-bold' : 'text-muted-foreground'}`}
                  onClick={() => {
                    setActiveTab(item.id as Tab);
                    setSelectedClient(null);
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold leading-none">{user.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">{user.email}</p>
                </div>
                <div className="relative group">
                   <img 
                    src={user.photoURL || ''} 
                    alt="User" 
                    className="h-9 w-9 rounded-full border-2 border-mamei/20 group-hover:border-mamei transition-all"
                    referrerPolicy="no-referrer"
                  />
                  <Button 
                    size="icon" 
                    variant="destructive" 
                    className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col gap-2">
                    <h2 className="text-4xl font-black tracking-tight">Dashboard Ejecutivo</h2>
                    <p className="text-muted-foreground">Resumen estratégico de operaciones y finanzas.</p>
                  </div>

                  {/* Top Stats Dashboard */}
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-none bg-gradient-to-br from-mamei to-orange-700 text-white shadow-xl shadow-mamei/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-2xl">
                            <Users className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase opacity-80">Proyectos Activos</p>
                            <h3 className="text-2xl font-black">{activeClients.length}</h3>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-none bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-xl shadow-blue-500/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-2xl">
                            <DollarSign className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase opacity-80">Total Por Cobrar</p>
                            <h3 className="text-2xl font-black">${(totalRevenue - totalCollected).toLocaleString()}</h3>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-none bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl shadow-indigo-500/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-2xl">
                            <Receipt className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase opacity-80">Gastos Totales (Mes)</p>
                            <h3 className="text-2xl font-black">${miscExpenses.reduce((acc, m) => acc + m.amount, 0).toLocaleString()}</h3>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-none bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-xl shadow-emerald-500/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-2xl">
                            <Wallet className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase opacity-80">Flujo de Caja Real</p>
                            <h3 className="text-2xl font-black">${availableCash.toLocaleString()}</h3>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-2">
                    <Card className="bg-card shadow-xl shadow-black/30 border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-mamei" /> Eficiencia Presupuestaria
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {activeClients.slice(0, 4).map(client => (
                          <div key={client.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold">{client.name}</span>
                              <span className="text-xs text-muted-foreground">${client.advanceAmount.toLocaleString()} / ${client.totalAmount.toLocaleString()}</span>
                            </div>
                            <Progress value={(client.advanceAmount / client.totalAmount) * 100} className="h-2" />
                          </div>
                        ))}
                        {activeClients.length === 0 && <p className="text-center text-muted-foreground py-10">No hay proyectos activos para mostrar.</p>}
                      </CardContent>
                    </Card>

                    <Card className="bg-card shadow-xl shadow-black/30 border-border overflow-hidden">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5 text-mamei" /> Actividad Reciente
                        </CardTitle>
                        <Button variant="link" size="sm" onClick={() => setActiveTab('historial')} className="text-mamei">Ver Todo</Button>
                      </CardHeader>
                      <Table>
                        <TableBody>
                          {miscExpenses.slice(0, 5).map(exp => (
                            <TableRow key={exp.id} className="hover:bg-muted/50 border-border">
                              <TableCell className="font-bold">{exp.store}</TableCell>
                              <TableCell className="text-muted-foreground">{exp.detail}</TableCell>
                              <TableCell className="text-right font-black text-harmony-red">-${exp.amount.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                          {miscExpenses.length === 0 && (
                             <TableRow>
                               <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Sin actividad reciente.</TableCell>
                             </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                </motion.div>
              )}
              {activeTab === 'clientes' && (
                <motion.div 
                  key="clientes"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {!selectedClient ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold tracking-tight text-foreground">Mis Clientes</h2>
                          <p className="text-muted-foreground">Gestiona tus proyectos activos.</p>
                        </div>
                        <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
                          <DialogTrigger render={
                            <Button className="rounded-full bg-mamei hover:bg-mamei/90 text-white px-6 shadow-lg shadow-mamei/20 transition-all hover:scale-105 active:scale-95">
                              <Plus className="mr-2 h-5 w-5" /> Nuevo Cliente
                            </Button>
                          } />
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>Agregar Nuevo Cliente</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddClient} className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="name">Nombre</Label>
                                  <Input id="name" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} required />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="phone">Teléfono</Label>
                                  <Input id="phone" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="location">Ubicación</Label>
                                <Input id="location" value={newClient.location} onChange={e => setNewClient({...newClient, location: e.target.value})} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="total">Monto Total</Label>
                                  <Input id="total" type="number" value={newClient.totalAmount} onChange={e => setNewClient({...newClient, totalAmount: e.target.value})} required />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="advance">Avance Inicial ($)</Label>
                                  <Input id="advance" type="number" value={newClient.advanceAmount} onChange={e => setNewClient({...newClient, advanceAmount: e.target.value})} required />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="progress">Porcentaje de Obra (%)</Label>
                                <Input id="progress" type="number" min="0" max="100" value={newClient.progressPercentage} onChange={e => setNewClient({...newClient, progressPercentage: e.target.value})} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="work">Trabajo Actual</Label>
                                <Input id="work" value={newClient.currentWork} onChange={e => setNewClient({...newClient, currentWork: e.target.value})} placeholder="Ej: Puertas, Ventanas P40..." />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="client-voucher">Subir Voucher (Imagen)</Label>
                                <Input id="client-voucher" type="file" accept="image/*" onChange={e => handleFileChange(e, 'client')} />
                                {newClient.voucherUrl && (
                                  <div className="mt-2 relative h-32 w-full rounded-lg overflow-hidden border border-border">
                                    <img src={newClient.voucherUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                )}
                              </div>
                              <DialogFooter>
                                <Button type="submit" className="w-full bg-mamei hover:bg-mamei/90 text-white font-bold py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                                  Guardar Cliente
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {renderClients(clients.filter(c => !c.status || c.status === 'active'))}
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <Button variant="ghost" onClick={() => setSelectedClient(null)} className="hover:bg-secondary rounded-full text-foreground">
                          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-harmony-red text-harmony-red hover:bg-harmony-red/10 rounded-full px-6 transition-all"
                          onClick={() => handleFinishWork(selectedClient.id)}
                        >
                          Finalizar Trabajo
                        </Button>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-1">
                          <CardHeader>
                            <CardTitle className="text-2xl">{selectedClient.name}</CardTitle>
                            <CardDescription>Detalles del Proyecto</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="rounded-full bg-secondary p-2"><Phone className="h-4 w-4 text-muted-foreground" /></div>
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase font-semibold">Teléfono</p>
                                  <p className="text-sm text-foreground">{selectedClient.phone || 'N/A'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="rounded-full bg-secondary p-2"><MapPin className="h-4 w-4 text-muted-foreground" /></div>
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase font-semibold">Ubicación</p>
                                  <p className="text-sm text-foreground">{selectedClient.location || 'N/A'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="rounded-full bg-secondary p-2"><DollarSign className="h-4 w-4 text-muted-foreground" /></div>
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase font-semibold">Monto Total</p>
                                  <p className="text-sm font-bold text-foreground">${selectedClient.totalAmount.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-foreground">Avance de Presupuesto</span>
                                  <Dialog open={isAddAdvanceOpen} onOpenChange={setIsAddAdvanceOpen}>
                                    <DialogTrigger render={
                                      <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold uppercase border-mamei text-mamei hover:bg-mamei/10 rounded-full">
                                        <Plus className="mr-1 h-3 w-3" /> Nuevo Avance
                                      </Button>
                                    } />
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Registrar Nuevo Avance</DialogTitle>
                                      </DialogHeader>
                                      <form onSubmit={handleAddAdvance} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="adv-amount">Monto ($)</Label>
                                          <Input id="adv-amount" type="number" value={newAdvance.amount} onChange={e => setNewAdvance({...newAdvance, amount: e.target.value})} required />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="voucher">Subir Voucher (Imagen)</Label>
                                          <Input id="voucher" type="file" accept="image/*" onChange={e => handleFileChange(e, 'advance')} />
                                          {newAdvance.voucherUrl && (
                                            <div className="mt-2 relative h-32 w-full rounded-lg overflow-hidden border border-border">
                                              <img src={newAdvance.voucherUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="adv-pass">Contraseña</Label>
                                          <Input id="adv-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                                        </div>
                                        <DialogFooter>
                                          <Button type="submit" className="w-full bg-mamei hover:bg-mamei/90 text-white font-bold py-6 rounded-xl">
                                            Guardar Avance
                                          </Button>
                                        </DialogFooter>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Disponible</span>
                                  <span className="text-sm font-bold text-foreground">${selectedClient.advanceAmount.toLocaleString()}</span>
                                </div>
                                <div className={`h-3 w-full rounded-full bg-secondary overflow-hidden`}>
                                  <div 
                                    className={`h-full transition-all duration-500 bg-mamei`} 
                                    style={{ width: `${Math.max(0, Math.min(100, (selectedClient.advanceAmount / selectedClient.totalAmount) * 100))}%` }} 
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm font-medium text-foreground">Progreso de Obra</span>
                                  <span className="text-sm font-bold text-foreground">{selectedClient.progressPercentage}%</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                                  <div 
                                    className="h-full bg-harmony-blue transition-all duration-500"
                                    style={{ width: `${selectedClient.progressPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="lg:col-span-2">
                          <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                              <CardTitle>Registro de Gastos</CardTitle>
                              <CardDescription>Historial de compras</CardDescription>
                            </div>
                            <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                              <DialogTrigger render={
                                <Button size="sm" className="bg-mamei hover:bg-mamei/90 text-white rounded-full px-4 transition-all hover:scale-105 active:scale-95">
                                  <Plus className="mr-2 h-4 w-4" /> Gasto
                                </Button>
                              } />
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleAddExpense} className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="store">Lugar</Label>
                                    <Input id="store" value={newExpense.store} onChange={e => setNewExpense({...newExpense, store: e.target.value})} required />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="detail">Detalle</Label>
                                    <Input id="detail" value={newExpense.detail} onChange={e => setNewExpense({...newExpense, detail: e.target.value})} required />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="amount">Monto ($)</Label>
                                    <Input id="amount" type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required />
                                  </div>
                                  <div className="space-y-3">
                                    <Label>Método de Pago</Label>
                                    <RadioGroup 
                                      value={newExpense.paymentMethod} 
                                      onValueChange={(v: 'cash' | 'card') => setNewExpense({...newExpense, paymentMethod: v})}
                                      className="flex gap-4"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="cash" id="e-cash" />
                                        <Label htmlFor="e-cash" className="flex items-center gap-1 cursor-pointer">
                                          <Banknote className="h-4 w-4" /> Efectivo
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="card" id="e-card" />
                                        <Label htmlFor="e-card" className="flex items-center gap-1 cursor-pointer">
                                          <CreditCard className="h-4 w-4" /> Tarjeta
                                        </Label>
                                      </div>
                                    </RadioGroup>
                                  </div>
                                  <DialogFooter>
                                    <Button type="submit" className="w-full bg-mamei hover:bg-mamei/90 text-white font-bold py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                                      Registrar Gasto
                                    </Button>
                                  </DialogFooter>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-[400px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Lugar</TableHead>
                                    <TableHead>Detalle</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {expenses.map(expense => (
                                    <TableRow key={expense.id}>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {expense.createdAt?.toDate().toLocaleDateString()}
                                      </TableCell>
                                      <TableCell className="font-medium text-foreground">{expense.store}</TableCell>
                                      <TableCell className="text-foreground">{expense.detail}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                          {expense.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-harmony-red">
                                        -${expense.amount.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8 text-harmony-red hover:bg-harmony-red/10"
                                          onClick={() => handleDeleteExpense(expense.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'deudas' && (
                <motion.div 
                  key="deudas"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Deudas</h2>
                    <p className="text-muted-foreground">Clientes activos con presupuesto agotado o negativo.</p>
                  </div>
                  {renderClients(clients.filter(c => (!c.status || c.status === 'active') && c.advanceAmount <= 0))}
                </motion.div>
              )}

              {activeTab === 'historial' && (
                <motion.div 
                  key="historial"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Historial</h2>
                    <p className="text-muted-foreground">Trabajos terminados y entregados.</p>
                  </div>
                  {renderClients(clients.filter(c => c.status === 'finished'))}
                </motion.div>
              )}

              {activeTab === 'gastos-varios' && (
                <motion.div 
                  key="gastos-varios"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-foreground">Gastos Varios</h2>
                      <p className="text-muted-foreground">Gastos generales no asociados a clientes.</p>
                    </div>
                    <Dialog open={isAddMiscExpenseOpen} onOpenChange={setIsAddMiscExpenseOpen}>
                      <div className="flex items-center gap-2">
                         <Dialog open={isAddCashOpen} onOpenChange={setIsAddCashOpen}>
                          <DialogTrigger render={
                            <Button variant="outline" className="rounded-full px-4 border-mamei text-mamei hover:bg-mamei/10">
                              <Banknote className="mr-2 h-4 w-4" /> Ajuste Caja
                            </Button>
                          } />
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Ajuste de Efectivo (Capital)</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddCash} className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="c-amount">Monto ($)</Label>
                                <Input id="c-amount" type="number" value={newCash.amount} onChange={e => setNewCash({...newCash, amount: e.target.value})} required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="c-reason">Razón / Fuente</Label>
                                <Input id="c-reason" value={newCash.reason} onChange={e => setNewCash({...newCash, reason: e.target.value})} placeholder="Ej: Capital Inicial Abril" required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="c-pass">Contraseña Admin</Label>
                                <Input id="c-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                              </div>
                              <DialogFooter>
                                <Button type="submit" className="w-full bg-mamei">Guardar Ajuste</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>

                        <DialogTrigger render={
                          <Button className="rounded-full bg-mamei hover:bg-mamei/90 text-white px-6 shadow-lg shadow-mamei/20 transition-all hover:scale-105 active:scale-95">
                            <Plus className="mr-2 h-5 w-5" /> Nuevo Gasto
                          </Button>
                        } />
                      </div>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Agregar Gasto General</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddMiscExpense} className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="m-store">Lugar</Label>
                            <Input id="m-store" value={newMiscExpense.store} onChange={e => setNewMiscExpense({...newMiscExpense, store: e.target.value})} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="m-detail">Detalle</Label>
                            <Input id="m-detail" value={newMiscExpense.detail} onChange={e => setNewMiscExpense({...newMiscExpense, detail: e.target.value})} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="m-amount">Monto ($)</Label>
                            <Input id="m-amount" type="number" value={newMiscExpense.amount} onChange={e => setNewMiscExpense({...newMiscExpense, amount: e.target.value})} required />
                          </div>
                          <div className="space-y-3">
                            <Label>Método de Pago</Label>
                            <RadioGroup 
                              value={newMiscExpense.paymentMethod} 
                              onValueChange={(v: 'cash' | 'card') => setNewMiscExpense({...newMiscExpense, paymentMethod: v})}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cash" id="cash" />
                                <Label htmlFor="cash" className="flex items-center gap-1 cursor-pointer">
                                  <Banknote className="h-4 w-4" /> Efectivo
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="card" id="card" />
                                <Label htmlFor="card" className="flex items-center gap-1 cursor-pointer">
                                  <CreditCard className="h-4 w-4" /> Tarjeta
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                          <DialogFooter>
                            <Button type="submit" className="w-full bg-mamei hover:bg-mamei/90 text-white font-bold py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                              Guardar Gasto
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Global Cash Summary */}
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Efectivo Disponible */}
                    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-2xl shadow-emerald-900/30">
                      <div className="absolute top-0 right-0 p-3 opacity-20">
                        <Wallet className="h-16 w-16" />
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Efectivo Disponible</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="text-4xl font-black tracking-tight">
                          ${availableCash.toLocaleString()}
                        </div>
                        <p className="text-[10px] opacity-70 mt-2 uppercase font-bold tracking-wider">Avances + Ajustes - Gastos</p>
                      </CardContent>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10" />
                    </Card>

                    {/* Saldo Restante */}
                    <Card className="relative overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                      <div className="absolute top-0 right-0 p-3 opacity-10">
                        <TrendingUp className="h-16 w-16 text-blue-600" />
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Saldo Restante</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="text-4xl font-black tracking-tight text-slate-900">
                          ${(
                            clients.reduce((acc, c) => acc + c.advanceAmount, 0) - 
                            miscExpenses.reduce((acc, m) => acc + m.amount, 0)
                          ).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-wider">Balance general de caja</p>
                      </CardContent>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500" />
                    </Card>

                    {/* Gastos Totales */}
                    <Card className="relative overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                      <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Receipt className="h-16 w-16 text-red-600" />
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Gastos Totales</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="text-4xl font-black tracking-tight text-red-600">
                          -${miscExpenses.reduce((acc, m) => acc + m.amount, 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-wider">Efectivo + Tarjeta</p>
                      </CardContent>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-red-500" />
                    </Card>
                  </div>

                  <Card>
                    <CardContent className="pt-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Lugar</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {miscExpenses.map(expense => (
                            <TableRow key={expense.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {expense.createdAt?.toDate().toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-medium text-foreground">{expense.store}</TableCell>
                              <TableCell className="text-foreground">{expense.detail}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="flex w-fit items-center gap-1 font-normal border-border text-muted-foreground">
                                  {expense.paymentMethod === 'cash' ? (
                                    <><Banknote className="h-3 w-3" /> Efectivo</>
                                  ) : (
                                    <><CreditCard className="h-3 w-3" /> Tarjeta</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold text-harmony-red">
                                -${expense.amount.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-harmony-red hover:bg-harmony-red/10"
                                  onClick={() => handleDeleteMiscExpense(expense.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      </main>

      {/* Navigation (Mobile View) */}
      <nav className="fixed bottom-0 left-0 z-50 w-full lg:hidden border-t border-border bg-card/95 backdrop-blur-md px-4 h-20 flex items-center justify-between pb-safe">
        {[
          { id: 'dashboard', icon: TrendingUp, label: 'Inicio' },
          { id: 'clientes', icon: Users, label: 'Proyectos' },
          { id: 'gastos-varios', icon: Banknote, label: 'Caja' },
          { id: 'historial', icon: History, label: 'Historial' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as Tab);
              setSelectedClient(null);
            }}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === item.id ? 'text-mamei transform scale-110 font-bold' : 'text-muted-foreground'
            } min-w-[64px]`}
          >
            <item.icon className="h-6 w-6" />
            <span className="text-[10px] uppercase tracking-tighter">{item.label}</span>
            {activeTab === item.id && (
              <motion.div layoutId="mobileNavDot" className="h-1 w-1 rounded-full bg-mamei mt-1" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
