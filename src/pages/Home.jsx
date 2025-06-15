import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);
  const [typingText, setTypingText] = useState('');

  const features = [
    {
      title: 'Performance Tracking',
      description: 'Real-time monitoring of employee productivity and task completion rates.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      title: 'Workflow Optimization',
      description: 'Intelligent task allocation and process streamlining for enhanced productivity.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    {
      title: 'Advanced Analytics',
      description: 'Deep insights into team performance and productivity trends for strategic decision-making.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  useEffect(() => {
    const featureRotation = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 5000);

    return () => clearInterval(featureRotation);
  }, []);

  useEffect(() => {
    const currentFeature = features[activeFeature];
    let currentIndex = 0;
    
    const typingInterval = setInterval(() => {
      if (currentIndex <= currentFeature.description.length) {
        setTypingText(currentFeature.description.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, [activeFeature]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1020] to-[#1a1a2e] text-white flex items-center justify-center p-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f1020]/50 to-[#1a1a2e]/50 backdrop-blur-sm"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-5xl w-full grid md:grid-cols-2 gap-12 bg-[#16213e]/60 rounded-2xl p-12 shadow-2xl border border-[#0f3460]/50"
      >
        {/* Left Section */}
        <div className="flex flex-col justify-center space-y-8">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Task Tracker
          </h1>
          
          <p className="text-xl text-gray-300">
            Boost Productivity Through Intelligent Workforce Management
          </p>

          <div className="flex space-x-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin/login')}
              className="px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              Admin Portal
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/worker/login')}
              className="px-8 py-3 border-2 border-purple-600 text-purple-400 rounded-full hover:bg-purple-600/20 transition-colors"
            >
              Employee Login
            </motion.button>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex flex-col space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                onClick={() => setActiveFeature(index)}
                className={`flex flex-col items-center p-4 rounded-xl cursor-pointer transition-all ${
                  activeFeature === index 
                    ? 'bg-blue-600/30 border border-blue-500' 
                    : 'bg-[#0f3460]/30 hover:bg-[#0f3460]/50'
                }`}
              >
                <div className={`mb-2 ${activeFeature === index ? 'text-blue-400' : 'text-gray-400'}`}>
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold text-center">{feature.title}</h3>
              </motion.div>
            ))}
          </div>

          <motion.div 
            key={activeFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f3460]/50 p-6 rounded-xl"
          >
            <h2 className="text-2xl font-bold mb-4 text-blue-400">
              {features[activeFeature].title}
            </h2>
            <p className="text-gray-300">{typingText}</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Home;