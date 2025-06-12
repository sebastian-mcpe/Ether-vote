import React, { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  User,
  CreditCard,
  UserCheck
} from "lucide-react";
import { validateDominicanID } from "../utils/dominican";

const Login = ({ setUser, setIsConnected, switchToRegister }) => {
  const [formData, setFormData] = useState({
    socialId: "",
    name: ""
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatIdInput = (value) => {
    // Remove any existing formatting
    const numbers = value.replace(/\D/g, '');

    // Apply format: 000-0000000-0
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 10)}-${numbers.slice(10, 11)}`;
    }
  };

  const handleIdChange = (e) => {
    const formatted = formatIdInput(e.target.value);
    handleInputChange('socialId', formatted);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!validateDominicanID(formData.socialId)) {
      toast.error("Please enter a valid Dominican ID (000-0000000-0)");
      return;
    }
    try {
      setLoading(true);
      console.log('Attempting login with:', { socialId: formData.socialId, name: formData.name });

      // First check localStorage
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const storedUser = JSON.parse(userData);
        console.log('Found stored user:', storedUser);

        // Verify credentials match
        if (storedUser.socialId === formData.socialId &&
          storedUser.name.toLowerCase() === formData.name.toLowerCase()) {
          setUser(storedUser);
          setIsConnected(true);
          toast.success(`Welcome back, ${storedUser.name}!`);
          return;
        } else {
          console.log('Stored user credentials do not match');
        }
      }

      // Check backend users.json via API
      try {
        console.log('Checking backend API...');
        const response = await fetch('http://localhost:3000/users');

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }

        const users = await response.json();
        console.log('Users from API:', Object.keys(users));

        // Find user by social ID (users object is keyed by socialId)
        const foundUser = users[formData.socialId];
        console.log('Found user in backend:', foundUser);
        if (foundUser && foundUser.name &&
          foundUser.name.toLowerCase() === formData.name.toLowerCase()) {
          // Create complete user object with socialId
          const completeUser = {
            ...foundUser,
            socialId: formData.socialId
          };

          console.log('Complete user object:', completeUser);

          // Store user in localStorage and set current user
          localStorage.setItem('currentUser', JSON.stringify(completeUser));
          setUser(completeUser);
          setIsConnected(true);
          toast.success(`Welcome back, ${foundUser.name}!`);
          console.log('Login successful');
          return;
        } else {
          console.log('User not found or name mismatch. Expected name:', foundUser?.name, 'Provided:', formData.name);
        }
      } catch (apiError) {
        console.error('API check failed:', apiError);
        toast.error(`API connection failed: ${apiError.message}`);
      }

      // If no match found, suggest registration
      toast.error("User not found. Please check your credentials or register.");

    } catch (error) {
      console.error('Login error:', error);
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }; return (
    <div className="w-full">
      <motion.div
        className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 p-8 relative overflow-hidden"
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-emerald-400 to-violet-500"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary-100 to-emerald-100 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-br from-violet-100 to-rose-100 rounded-full blur-2xl opacity-40"></div>        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center mb-8 relative z-10"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-primary-700 to-slate-800 bg-clip-text text-transparent mb-3">
            Iniciar Sesión
          </h1>
          <p className="text-slate-600 text-lg font-medium">
            Accede a tu cuenta de <span className="text-primary-600 font-semibold">BlockVote</span>
          </p>

          {/* Decorative line */}
          <div className="flex items-center justify-center mt-6 mb-2">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent w-24"></div>
            <div className="w-2 h-2 bg-primary-400 rounded-full mx-4 animate-pulse-soft"></div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent w-24"></div>
          </div>
        </motion.div>

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">          {/* Name Field */}          <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative"
        >
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <div className="w-5 h-5 bg-primary-100 rounded-lg flex items-center justify-center">
              <User className="w-3 h-3 text-primary-600" />
            </div>
            Nombre Completo
          </label>
          <div className="relative">
            <input
              type="text"
              className="w-full bg-slate-50/50 border border-slate-200 text-slate-900 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 placeholder-slate-400 font-medium"
              placeholder="Escribe tu nombre completo"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/5 to-emerald-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          </div>
        </motion.div>

          {/* Dominican ID Field */}          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="relative"
          >
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <div className="w-5 h-5 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-3 h-3 text-emerald-600" />
              </div>
              Cédula Dominicana
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-900 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 placeholder-slate-400 font-mono"
                placeholder="000-0000000-0"
                value={formData.socialId}
                onChange={handleIdChange}
                maxLength={13}
                required
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/5 to-emerald-500/5 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </div>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-slate-500 mt-3 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100"
            >
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-soft"></span>
              Formato requerido: 000-0000000-0
            </motion.p>
          </motion.div>          {/* Submit Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 hover:from-primary-600 hover:via-primary-700 hover:to-primary-800 text-white font-semibold text-lg py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-button-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
          >
            {/* Button background animation */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-emerald-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>

            <div className="flex items-center justify-center space-x-3 relative z-10">
              {loading ? (
                <>
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando credenciales...</span>                </>) : (
                <>
                  <span>Iniciar Sesión</span>
                </>
              )}
            </div>

            {/* Subtle shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          </motion.button>
        </form>        {/* Register Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-8 text-center relative z-10"
        >
          <div className="relative">
            <p className="text-slate-600 text-base">
              ¿No tienes una cuenta?{' '}
              <button
                onClick={switchToRegister}
                className="text-primary-600 hover:text-primary-700 font-semibold transition-all duration-300 hover:underline decoration-2 underline-offset-2 relative group"
              >
                Regístrate aquí
                <span className="absolute inset-0 bg-primary-100 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300 -m-1"></span>
              </button>
            </p>
          </div>
        </motion.div>

        {/* Enhanced Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-8 p-5 bg-gradient-to-br from-primary-50 via-emerald-50 to-violet-50 border border-primary-200/50 rounded-2xl relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary-200 to-emerald-200 rounded-full blur-2xl opacity-30"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-br from-violet-200 to-rose-200 rounded-full blur-xl opacity-40"></div>

          <div className="flex items-start space-x-4 relative z-10">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-soft">
              <UserCheck className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-primary-800 font-bold text-base mb-2 flex items-center gap-2">
                Autenticación Segura
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-soft"></div>
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                Tus credenciales se verifican de forma segura. Utilizamos tecnología blockchain
                para garantizar la <span className="font-semibold text-primary-700">privacidad</span> y
                <span className="font-semibold text-emerald-700"> transparencia</span> de tu voto.
              </p>

              {/* Security indicators */}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  Encriptado
                </div>
                <div className="flex items-center gap-1 text-xs text-primary-600 font-medium">
                  <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                  Blockchain
                </div>
                <div className="flex items-center gap-1 text-xs text-violet-600 font-medium">
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                  Anónimo
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
