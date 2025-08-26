import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import { resetPasswordWithOtp } from '../../services/authService';
import { motion } from 'framer-motion';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';

const ResetPassword = () => {
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // The subdomain is passed as state from ForgotPassword page
    const subdomain = location.state?.subdomainForReset || '';

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        // Here, we simulate OTP verification.
        // In a real scenario, you'd send the OTP to the backend for validation.
        // For this implementation, we combine it with the final password reset.
        setIsOtpVerified(true);
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        
        if (!subdomain) {
            toast.error('Company name is missing. Please restart the process.');
            return;
        }

        setIsLoading(true);

        try {
            await resetPasswordWithOtp({ subdomain, otp, password });
            toast.success('Password reset successfully. You can now log in.');
            navigate('/admin/login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1020] to-[#1a1a2e] text-white overflow-hidden relative">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-[85%] max-w-md z-10 bg-[#121630]/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-[#2a3260] mx-auto"
            >
                <div className="mb-8 text-center">
                    <motion.h1
                        className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600"
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {isOtpVerified ? 'Set New Password' : 'Verify OTP'}
                    </motion.h1>
                </div>

                {!isOtpVerified ? (
                    <form onSubmit={handleOtpSubmit} className="space-y-5">
                        <motion.div
                            className="form-group"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <label htmlFor="otp" className="text-gray-300 flex items-center text-sm font-medium mb-2">
                                OTP
                            </label>
                            <input
                                type="text"
                                id="otp"
                                name="otp"
                                className="w-full px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                placeholder="Enter the OTP from your email"
                            />
                        </motion.div>
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
                            Verify OTP
                        </motion.button>
                    </form>
                ) : (
                    <form onSubmit={handlePasswordSubmit} className="space-y-5">
                        <motion.div
                            className="form-group relative"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <label htmlFor="password" className="text-gray-300 flex items-center text-sm font-medium mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                className="w-full px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white pr-10"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="6"
                                placeholder="Enter your new password"
                            />
                        </motion.div>

                        <motion.div
                            className="form-group relative"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                        >
                            <label htmlFor="confirmPassword" className="text-gray-300 flex items-center text-sm font-medium mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                className="w-full px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white pr-10"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength="6"
                                placeholder="Confirm your new password"
                            />
                        </motion.div>

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
                                    <Spinner size="sm" className="mr-2" />
                                    Resetting...
                                </span>
                            ) : 'Reset Password'}
                        </motion.button>
                    </form>
                )}
            </motion.div>
        </div>
    );
};

export default ResetPassword;