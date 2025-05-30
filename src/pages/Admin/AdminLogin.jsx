import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import appContext from '../../context/AppContext';
import { motion } from 'framer-motion';

const AdminLogin = () => {
  const { subdomain } = useContext(appContext);
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    subdomain
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // Generate floating particles for background animation
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5
  }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials({ ...credentials, [name]: value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsLoading(true);
    
    try {
      const result = await login(credentials, 'admin');
      localStorage.setItem('tasktracker-subdomain', result.subdomain);
      toast.success('Login successful!');
      navigate('/admin');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1020] to-[#1a1a2e] text-white overflow-hidden relative">
      {/* Animated Particles Background */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-blue-500/20"
          initial={{ 
            x: `${particle.x}%`, 
            y: `${particle.y}%`, 
            opacity: 0.1 + Math.random() * 0.3 
          }}
          animate={{ 
            x: [`${particle.x}%`, `${particle.x + (Math.random() * 10 - 5)}%`],
            y: [`${particle.y}%`, `${particle.y - 20}%`],
            opacity: [0.1 + Math.random() * 0.3, 0]
          }}
          transition={{ 
            repeat: Infinity,
            duration: particle.duration,
            delay: particle.delay,
            ease: "linear"
          }}
          style={{ 
            width: `${particle.size}px`, 
            height: `${particle.size}px` 
          }}
        />
      ))}

      {/* Animated Gradient Wave */}
      <div className="absolute bottom-0 left-0 w-full h-48 overflow-hidden z-0">
        <motion.div 
          className="absolute w-[200%] h-40 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-t-full"
          initial={{ x: "0%" }}
          animate={{ x: "-100%" }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          style={{ bottom: -20 }}
        />
        <motion.div 
          className="absolute w-[200%] h-40 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 rounded-t-full"
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          style={{ bottom: -15 }}
        />
      </div>

      {/* Login Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-[85%] max-w-md z-10 bg-[#121630]/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-[#2a3260] mx-auto"
      >
        {/* Login Title with Animated Underline */}
        <div className="mb-8 text-center">
          <motion.h1 
            className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600"
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Admin Login
          </motion.h1>
          <motion.div 
            className="h-1 bg-blue-500 rounded-full w-0 mx-auto mt-2"
            initial={{ width: 0 }}
            animate={{ width: "50px" }}
            transition={{ duration: 0.5, delay: 0.4 }}
          />
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Field */}
          <motion.div 
            className="form-group"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <label htmlFor="username" className="text-gray-300 flex items-center text-sm font-medium mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="w-full px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              value={credentials.username}
              onChange={handleChange}
              placeholder="Enter your username"
              required
            />
          </motion.div>
          
          {/* Password Field */}
          <motion.div 
            className="form-group relative"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <label htmlFor="password" className="text-gray-300 flex items-center text-sm font-medium mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className="w-full px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white pr-10"
                value={credentials.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </motion.div>
          
          {/* Login Button */}
          <motion.button
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              type: "spring", 
              duration: 0.5, 
              delay: 0.5,
              stiffness: 120 
            }}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 font-medium"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
              </span>
            ) : 'Sign In'}
          </motion.button>
        </form>
        
        {/* Create Account Link */}
        <motion.p 
          className="mt-6 text-center text-gray-400 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Don't have an account?{' '}
          <Link 
            to="/admin/register" 
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Create Account
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;