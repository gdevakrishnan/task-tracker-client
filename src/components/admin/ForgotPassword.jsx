import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordResetOtp } from '../../services/authService';
import { motion } from 'framer-motion';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';

const ForgotPassword = () => {
    const [subdomain, setSubdomain] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await requestPasswordResetOtp({ subdomain });
            toast.success('An OTP has been sent to your registered email address.');
            navigate('/admin/login', { state: { subdomainForReset: subdomain } }); // Redirect back to login with a state indicating reset flow started
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send password reset OTP.');
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
                        Forgot Password
                    </motion.h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <motion.div
                        className="form-group"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <label htmlFor="subdomain" className="text-gray-300 flex items-center text-sm font-medium mb-2">
                            Company Name
                        </label>
                        <input
                            type="text"
                            id="subdomain"
                            name="subdomain"
                            className="w-full px-4 py-3 bg-[#1d2451]/50 border border-[#2a3260] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                            value={subdomain}
                            onChange={(e) => setSubdomain(e.target.value)}
                            required
                            placeholder="Enter your company name"
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
                                Sending OTP...
                            </span>
                        ) : 'Send OTP'}
                    </motion.button>
                </form>

                <motion.p
                    className="mt-6 text-center text-gray-400 text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    <Link
                        to="/admin/login"
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                        Back to Login
                    </Link>
                </motion.p>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;