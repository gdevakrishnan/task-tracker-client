import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaSearch,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import { IoMdRefresh } from "react-icons/io";
import { useAuth } from '../../hooks/useAuth';
import { getPublicWorkers } from '../../services/workerService';
import Spinner from '../../components/common/Spinner';
import appContext from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

const WorkerLogin = () => {
  const [workers, setWorkers] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [department, setDepartment] = useState('All');
  const [manualSubdomain, setManualSubdomain] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const { subdomain, setSubdomain } = useContext(appContext);

  const workersPerPage = 12;
  const totalWorkers = filteredWorkers.length;
  const totalPages = Math.ceil(totalWorkers / workersPerPage);

  // Handle subdomain submission
  const handleSubdomainSubmit = (e) => {
    e.preventDefault();
    if (!manualSubdomain) {
      toast.error('Please enter a subdomain.');
      return;
    }
    localStorage.setItem('tasktracker-subdomain', manualSubdomain);
    setSubdomain(manualSubdomain);
  };

  // Load workers
  const loadWorkers = useCallback(async () => {
    if (!subdomain || subdomain === 'main') return;

    try {
      setIsLoadingWorkers(true);
      const workersData = await getPublicWorkers({ subdomain });
      setWorkers(workersData || []);
    } catch (error) {
      console.error('Employee load error:', error);
      toast.error('Failed to load employees. Please try again later.');
    } finally {
      setIsLoadingWorkers(false);
    }
  }, [subdomain]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers, subdomain]);

  // Filter workers
  useEffect(() => {
    const filtered = workers.filter(worker => {
      const matchesSearch = !searchTerm ||
        worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (worker.department && worker.department.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesDepartment = department === 'All' ||
        worker.department === department;

      return matchesSearch && matchesDepartment;
    });

    setFilteredWorkers(filtered);
    setCurrentPage(1);
  }, [workers, searchTerm, department]);

  const paginatedWorkers = filteredWorkers.slice(
    (currentPage - 1) * workersPerPage,
    currentPage * workersPerPage
  );

  const departments = ['All', ...new Set(workers.map(w => w.department).filter(Boolean))];

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!selectedWorker || !password) {
      toast.error('Please select a employee and enter password');
      return;
    }

    if (!subdomain || subdomain === 'main') {
      toast.error('Subdomain is missing, please check the URL');
      return;
    }

    setIsLoading(true);

    try {
      const response = await login({
        username: selectedWorker.username,
        password,
        subdomain
      }, 'worker');

      toast.success(`Welcome, ${selectedWorker.name}!`);
      navigate('/worker');
    } catch (error) {
      toast.error(error.message || 'Login failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (currentPage > 1) {
      pageNumbers.push(
        <motion.button 
          key="prev" 
          onClick={() => setCurrentPage(currentPage - 1)} 
          className="p-2 bg-[#1d2451]/80 text-blue-400 rounded-full hover:bg-[#1d2451] transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <FaChevronLeft />
        </motion.button>
      );
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <motion.button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`w-9 h-9 rounded-full flex items-center justify-center ${
            currentPage === i 
              ? 'bg-blue-600 text-white' 
              : 'bg-[#1d2451]/50 text-gray-300 hover:bg-[#1d2451] hover:text-white'
          } transition-colors`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {i}
        </motion.button>
      );
    }

    if (currentPage < totalPages) {
      pageNumbers.push(
        <motion.button 
          key="next" 
          onClick={() => setCurrentPage(currentPage + 1)} 
          className="p-2 bg-[#1d2451]/80 text-blue-400 rounded-full hover:bg-[#1d2451] transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <FaChevronRight />
        </motion.button>
      );
    }

    return <div className="flex justify-center items-center space-x-3 mt-8">{pageNumbers}</div>;
  };

  // Generate floating particles for background animation
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5
  }));

  // Show subdomain form if subdomain is missing
  if (!subdomain || subdomain === 'main') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1020] to-[#1a1a2e] text-white p-4 relative overflow-hidden">
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
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-[85%] max-w-md z-10 bg-[#121630]/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-[#2a3260] mx-auto"
        >
          <div className="mb-6 text-center">
            <motion.h1 
              className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600"
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Enter Your Company Name
            </motion.h1>
            <motion.div 
              className="h-1 bg-blue-500 rounded-full w-0 mx-auto mt-2"
              initial={{ width: 0 }}
              animate={{ width: "60px" }}
              transition={{ duration: 0.5, delay: 0.4 }}
            />
          </div>

          <form onSubmit={handleSubdomainSubmit} className="space-y-4">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <label className="text-gray-300 text-sm font-medium mb-2 block">Company Domain</label>
              <input
                type="text"
                placeholder="e.g. company123"
                value={manualSubdomain}
                onChange={(e) => setManualSubdomain(e.target.value)}
                className="w-full px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                required
              />
            </motion.div>
            
            <motion.button
              type="submit"
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
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Main Worker Login UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1020] to-[#1a1a2e] text-white p-4 relative overflow-hidden">
      {/* Animated Particles */}
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
      
      {/* Gradient Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>
      
      <div className="container mx-auto relative z-10">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4"
        >
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Employee Login
          </h1>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              />
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" />
            </div>

            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {isLoadingWorkers ? (
          <div className="flex justify-center items-center h-96">
            <Spinner size="lg" className="text-blue-500" />
          </div>
        ) : filteredWorkers.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center py-16 text-gray-300"
          >
            No employees found. Try adjusting your search or filter.
            <motion.button
              whileHover={{ scale: 1.1, rotate: 180 }}
              transition={{ duration: 0.5 }}
              className='block mx-auto bg-[#1d2451]/60 border border-[#2a3260] p-3 my-3 rounded-full text-blue-400'
              onClick={loadWorkers}
            >
              <IoMdRefresh />
            </motion.button>
          </motion.div>
        ) : (
          <>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
            >
              {paginatedWorkers.map((worker, index) => (
                <motion.div
                  key={worker._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => setSelectedWorker(worker)}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className={`cursor-pointer p-4 rounded-lg text-center transition-all ${
                    selectedWorker?._id === worker._id
                      ? 'bg-[#1d2451]/90 border-2 border-blue-500 shadow-lg shadow-blue-500/20'
                      : 'bg-[#1d2451]/40 border border-[#2a3260] hover:border-blue-500/50'
                  }`}
                >
                  <div className="w-20 h-20 rounded-full mx-auto mb-3 overflow-hidden border-2 border-blue-500/30">
                    <img
                      src={
                        worker.photo
                          ? worker.photo
                          : `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=0f3460&color=fff`
                      }
                      alt="Employee"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <h3 className="font-medium truncate text-white">{worker.name}</h3>
                  <p className="text-xs text-blue-400/80 truncate">{worker.department}</p>
                </motion.div>
              ))}
            </motion.div>

            {renderPagination()}
          </>
        )}

        {/* Worker Login Modal */}
        <AnimatePresence>
          {selectedWorker && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedWorker(null);
              }}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-[#121630]/95 border border-[#2a3260] rounded-2xl p-6 w-full max-w-md shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500/50 mr-4">
                    <img
                      src={
                        selectedWorker.photo
                          ? selectedWorker.photo
                          : `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedWorker.name)}&background=0f3460&color=fff`
                      }
                      alt="Employee"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedWorker.name}</h2>
                    <p className="text-blue-400">{selectedWorker.department}</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedWorker(null)}
                    className="ml-auto text-gray-400 hover:text-white focus:outline-none rounded-full w-8 h-8 flex items-center justify-center bg-[#1d2451]/50 hover:bg-[#1d2451]"
                  >
                    ✕
                  </motion.button>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="form-group relative">
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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
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
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WorkerLogin;