// Worker Test Component - View and take assigned tests
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Card from '../common/Card';
import Spinner from '../common/Spinner';
import { FaClock, FaPlay, FaStop, FaCheckCircle, FaTimesCircle, FaHistory, FaBook, FaTrophy, FaAward, FaCalendarAlt, FaChartBar } from 'react-icons/fa';

const WorkerTest = () => {
    const { user } = useAuth();
    const [step, setStep] = useState('dashboard'); // 'dashboard', 'test', 'result', 'scoreboard'
    const [availableTests, setAvailableTests] = useState([]);
    const [testHistory, setTestHistory] = useState([]);
    const [filteredTestHistory, setFilteredTestHistory] = useState([]);
    const [currentTest, setCurrentTest] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalTimeLeft, setTotalTimeLeft] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false); // Used to track fullscreen state
    const [fullscreenExits, setFullscreenExits] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    const [testResults, setTestResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('available'); // 'available', 'history'
    const [scoreboard, setScoreboard] = useState([]);
    const [scoreboardLoading, setScoreboardLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(''); // For date filtering
    const [searchTerm, setSearchTerm] = useState(''); // For name search filtering
    const [filteredScoreboard, setFilteredScoreboard] = useState([]); // For filtered scoreboard
    const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const timerRef = useRef(null);
    const totalTimerRef = useRef(null);
    const testCompletedNaturally = useRef(false); // New ref to track natural test completion

    useEffect(() => {
        fetchAvailableTests();
        fetchTestHistory();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            const filtered = testHistory.filter(test => {
                const testDate = new Date(test.createdAt);
                const filterDate = new Date(selectedDate);
                return testDate.toDateString() === filterDate.toDateString();
            });
            setFilteredTestHistory(filtered);
        } else {
            setFilteredTestHistory(testHistory);
        }
    }, [selectedDate, testHistory]);

    // Fullscreen and anti-cheat logic
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!document.fullscreenElement;
            
            // Log to help debug the issue
            console.log('Fullscreen change detected');
            console.log('Currently in fullscreen:', isCurrentlyFullscreen);
            console.log('Current exit count:', fullscreenExits);
            console.log('Test completed naturally:', testCompletedNaturally.current);
            
            setIsFullscreen(isCurrentlyFullscreen);
            
            // Only show warning if test is in progress and not naturally completed
            if (step === 'test' && !isCurrentlyFullscreen && !testCompletedNaturally.current) {
                // Use functional update to ensure we have the latest state
                setFullscreenExits(prevExits => {
                    const newExitCount = prevExits + 1;
                    console.log('Incrementing exit count to:', newExitCount);
                    
                    if (newExitCount === 1) {
                        // First exit - show warning
                        setShowWarning(true);
                        pauseTest();
                    } else if (newExitCount >= 2) {
                        // Second exit - auto submit immediately
                        console.log('Second exit detected, auto-submitting test');
                        handleSubmitTest();
                    }
                    
                    return newExitCount;
                });
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Disable right-click and copy/paste during test
        const handleContextMenu = (e) => {
            if (step === 'test') e.preventDefault();
        };
        
        const handleKeyDown = (e) => {
            if (step === 'test') {
                // Disable F12, Ctrl+Shift+I, Ctrl+U, Ctrl+C, Ctrl+V, etc.
                if (e.key === 'F12' || 
                    (e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
                    (e.ctrlKey && (e.key === 'c' || e.key === 'C')) ||
                    (e.ctrlKey && (e.key === 'v' || e.key === 'V'))) {
                    e.preventDefault();
                }
            }
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [step, fullscreenExits, testCompletedNaturally.current]);

    // Question timer
    useEffect(() => {
        if (step === 'test' && timeLeft > 0) {
            timerRef.current = setTimeout(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && step === 'test') {
            // Time ran out for current question, move to next or submit
            console.log('Question time ran out, moving to next question or submitting');
            handleNextQuestion();
        }
        
        return () => clearTimeout(timerRef.current);
    }, [timeLeft, step]);

    // Total test timer
    useEffect(() => {
        if (step === 'test' && totalTimeLeft > 0) {
            totalTimerRef.current = setTimeout(() => {
                setTotalTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (totalTimeLeft === 0 && step === 'test') {
            // Test time expired - submit regardless of fullscreen state or other conditions
            console.log('Total test time expired, auto-submitting');
            handleSubmitTest();
        }
        
        return () => clearTimeout(totalTimerRef.current);
    }, [totalTimeLeft, step]);

    const fetchAvailableTests = async () => {
        try {
            setLoading(true);
            // Debug log to check user object
            console.log('User object:', user);
            console.log('User ID:', user._id);
            console.log('User type:', typeof user._id);
            
            // Ensure we're using the correct user ID
            const userId = user._id || user.id;
            if (!userId) {
                throw new Error('User ID not found');
            }
            
            console.log('Making request with userId:', userId);
            const response = await api.get(`/test/questions/${userId}`);
            console.log('Response received:', response.data);
            setAvailableTests([response.data]);
        } catch (error) {
            console.error('Error fetching available tests:', error);
            // Show a more user-friendly error message
            if (error.response && error.response.status === 403) {
                console.error('Access denied - check if you are authorized to access this resource');
                console.error('Response data:', error.response.data);
            } else if (error.response && error.response.status === 401) {
                console.error('Authentication required - please log in again');
            } else {
                console.error('Other error:', error.message);
            }
            setAvailableTests([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchTestHistory = async () => {
        try {
            const response = await api.get(`/test/scores?workerId=${user._id}`);
            setTestHistory(response.data || []);
            setFilteredTestHistory(response.data || []);
        } catch (error) {
            console.error('Error fetching test history:', error);
            setTestHistory([]);
            setFilteredTestHistory([]);
        }
    };

    const fetchScoreboard = async () => {
        try {
            setScoreboardLoading(true);
            // Get scoreboard for all workers (accessible to employees)
            // Add date parameter if selected
            const params = new URLSearchParams();
            if (selectedDate) {
                params.append('date', selectedDate);
            }
            
            const response = await api.get(`/test/scores?${params.toString()}`);
            
            // Aggregate scores by employee
            const employeeMap = new Map();
            
            response.data.forEach(testAttempt => {
                const workerId = testAttempt.worker?._id || testAttempt._id;
                const workerName = testAttempt.worker?.name || 'Unknown';
                
                if (!employeeMap.has(workerId)) {
                    employeeMap.set(workerId, {
                        _id: workerId,
                        name: workerName,
                        worker: testAttempt.worker,
                        totalScore: 0,
                        totalPossibleScore: 0,
                        testCount: 0,
                        percentage: 0
                    });
                }
                
                const employee = employeeMap.get(workerId);
                employee.totalScore += testAttempt.score || 0;
                employee.totalPossibleScore += testAttempt.totalQuestions || 0;
                employee.testCount += 1;
                employee.percentage = employee.totalPossibleScore > 0 
                    ? Math.round((employee.totalScore / employee.totalPossibleScore) * 100) 
                    : 0;
            });
            
            // Convert map to array and sort by percentage (descending)
            const aggregatedScores = Array.from(employeeMap.values())
                .sort((a, b) => b.percentage - a.percentage);
                
            setScoreboard(aggregatedScores);
            setFilteredScoreboard(aggregatedScores); // Initialize filtered scoreboard
        } catch (error) {
            console.error('Error fetching scoreboard:', error);
            setScoreboard([]);
            setFilteredScoreboard([]); // Reset filtered scoreboard on error
        } finally {
            setScoreboardLoading(false);
        }
    };

    // Add useEffect to refetch scoreboard when date filter changes
    useEffect(() => {
        if (step === 'scoreboard') {
            fetchScoreboard();
        }
    }, [selectedDate, step]);

    // Filter scoreboard based on search term (date filter is handled by backend)
    useEffect(() => {
        // For the search filter, we filter the already date-filtered scoreboard
        let filtered = scoreboard;
        
        // Apply name search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(worker => 
                (worker.name && worker.name.toLowerCase().includes(term)) ||
                (worker.worker?.name && worker.worker.name.toLowerCase().includes(term))
            );
        }
        
        setFilteredScoreboard(filtered);
    }, [searchTerm, scoreboard]);

    const startTest = async (test) => {
        try {
            setLoading(true);
            setCurrentTest(test);
            setCurrentQuestionIndex(0);
            setAnswers(new Array(test.questions.length).fill(null));
            setTimeLeft(test.durationPerQuestion);
            
            // Ensure totalTestDuration is in seconds (convert if needed)
            const totalDuration = parseInt(test.totalTestDuration);
            // If it's a small value like 10, it might be in minutes - convert to seconds
            if (totalDuration < 100) {
                setTotalTimeLeft(totalDuration * 60);
                console.log(`Converting ${totalDuration} minutes to ${totalDuration * 60} seconds for total time`);
            } else {
                setTotalTimeLeft(totalDuration);
                console.log(`Using ${totalDuration} seconds for total time`);
            }
            
            setFullscreenExits(0);
            testCompletedNaturally.current = false; // Reset the flag
            setStep('test');
            
            // Enter fullscreen
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            } else {
                console.log('Fullscreen not supported');
            }
        } catch (error) {
            console.error('Error starting test:', error);
            // Show a more user-friendly message instead of an alert
            alert('Unable to start test in fullscreen mode. Please ensure your browser supports fullscreen.');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = (optionIndex) => {
        if (!currentTest || !currentTest.questions || !currentTest.questions[currentQuestionIndex]) {
            console.error('Cannot select answer: Question data is missing');
            return;
        }
        
        // If answer already selected, don't process again
        if (answers[currentQuestionIndex] !== null && answers[currentQuestionIndex] !== undefined) {
            console.log('Answer already selected for this question');
            return;
        }
        
        // Save the selected answer index
        setSelectedAnswerIndex(optionIndex);
        
        // Record the answer in the answers array
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = optionIndex;
        setAnswers(newAnswers);
        
        // Show feedback for the selected answer (correct/incorrect)
        setShowFeedback(true);
        
        // Wait 2-3 seconds before moving to the next question or submitting
        setTimeout(() => {
            setShowFeedback(false);
            setSelectedAnswerIndex(null);
            
            if (currentQuestionIndex < currentTest.questions.length - 1) {
                // Move to next question
                setCurrentQuestionIndex(prev => prev + 1);
                setTimeLeft(currentTest.durationPerQuestion);
            } else {
                // Last question - auto submit
                console.log('Last question answered, auto-submitting test');
                
                // Use setTimeout with higher priority to ensure it runs before other timers
                setTimeout(() => {
                    console.log('Auto-submitting test after last question');
                    // Use the updated answers array directly instead of relying on state
                    handleSubmitTest(newAnswers);
                }, 300); // Shorter delay to ensure it runs before other potential submit calls
            }
        }, 2500); // 2.5 seconds delay for visual feedback
    };

    const handleNextQuestion = () => {
        // Clear any existing timers
        clearTimeout(timerRef.current);
        
        if (currentQuestionIndex < currentTest.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setTimeLeft(currentTest.durationPerQuestion);
        } else {
            console.log('Last question reached via handleNextQuestion, auto-submitting test');
            
            // Directly submit without setting the flag first to avoid race conditions
            setTimeout(() => {
                console.log('Auto-submitting test after delay');
                handleSubmitTest();
            }, 300); // Short delay to ensure UI updates complete
        }
    };

    const pauseTest = () => {
        // Pause timers when showing warning
        clearTimeout(timerRef.current);
        clearTimeout(totalTimerRef.current);
    };

    const resumeTest = async () => {
        console.log('Resuming test, returning to fullscreen');
        setShowWarning(false);
        // Do NOT reset the fullscreen exit counter - we want to track multiple exits
        try {
            await document.documentElement.requestFullscreen();
            console.log('Successfully returned to fullscreen mode');
        } catch (error) {
            console.error('Failed to return to fullscreen mode:', error);
            // If we can't return to fullscreen, consider submitting the test
            if (fullscreenExits >= 1) {
                console.log('Already had one warning and failed to return to fullscreen, submitting test');
                handleSubmitTest();
            }
        }
    };

    const handleSubmitTest = async (submittedAnswers = null) => {
        // Don't use testCompletedNaturally.current to prevent submission
        // Only check if submission is already in progress
        if (loading) {
            console.log('Submission already in progress, ignoring additional submit attempt');
            return;
        }
        
        try {
            console.log('Submitting test, fullscreen exits:', fullscreenExits);
            setLoading(true);
            
            // Set the flag to indicate natural test completion
            testCompletedNaturally.current = true;
            
            // Exit fullscreen
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }

            // Use the passed answers array if provided, otherwise use the state
            const answersToSubmit = submittedAnswers || answers;
            
            const submissionData = currentTest.questions.map((question, index) => ({
                questionId: question._id,
                selectedOption: answersToSubmit[index] !== null && answersToSubmit[index] !== undefined ? answersToSubmit[index] : -1
            }));

            // Add error handling for the API call
            try {
                const response = await api.post(`/test/submit/${currentTest.testAttemptId}`, {
                    answers: submissionData
                });

                setTestResults(response.data);
                setStep('result');
                
                // Refresh test data
                fetchAvailableTests();
                fetchTestHistory();
                
                // Show scoreboard after 5 seconds, without date filter (show all-time scores)
                console.log('Test submitted successfully, showing results for 5 seconds before redirecting to scoreboard');
                setTimeout(() => {
                    // Remove the date filter to show all-time scores
                    setSelectedDate(''); // Clear any date filter
                    fetchScoreboard();
                    setStep('scoreboard');
                    console.log('Redirected to scoreboard after 5 seconds');
                }, 5000);
            } catch (apiError) {
                console.error('API Error submitting test:', apiError);
                // Show a more user-friendly message instead of an alert
                setTestResults({
                    score: (submittedAnswers || answers).filter(a => a !== null).length, // Count answered questions
                    totalQuestions: currentTest.questions.length,
                    message: 'Test submitted with issues. Please contact administrator.'
                });
                setStep('result');
                
                // Still show scoreboard after 5 seconds even if there was an error
                console.log('Test submitted with issues, showing results for 5 seconds before redirecting to scoreboard');
                setTimeout(() => {
                    setSelectedDate(''); // Clear any date filter
                    fetchScoreboard();
                    setStep('scoreboard');
                    console.log('Redirected to scoreboard after 5 seconds');
                }, 5000);
            }
        } catch (error) {
            console.error('Error submitting test:', error);
            // Show a more user-friendly message instead of an alert
            setTestResults({
                score: (submittedAnswers || answers).filter(a => a !== null).length, // Count answered questions
                totalQuestions: currentTest.questions.length,
                message: 'Test submitted with technical issues.'
            });
            setStep('result');
            
            // Still show scoreboard after 5 seconds even if there was an error
            console.log('Test submitted with technical issues, showing results for 5 seconds before redirecting to scoreboard');
            setTimeout(() => {
                setSelectedDate(''); // Clear any date filter
                fetchScoreboard();
                setStep('scoreboard');
                console.log('Redirected to scoreboard after 5 seconds');
            }, 5000);
        } finally {
            setLoading(false);
        }
    };

    const backToDashboard = () => {
        setStep('dashboard');
        setCurrentTest(null);
        setCurrentQuestionIndex(0);
        setAnswers([]);
        setTimeLeft(0);
        setTotalTimeLeft(0);
        setFullscreenExits(0);
        setShowWarning(false);
        setTestResults(null);
        testCompletedNaturally.current = false; // Reset the flag
        // Exit fullscreen if still in fullscreen mode
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log('Error exiting fullscreen:', err));
        }
    };

    const goToScoreboard = () => {
        // Remove the date filter to show all-time scores by default
        setSelectedDate(''); // Clear any date filter
        fetchScoreboard();
        setStep('scoreboard');
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (step === 'dashboard') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">My Tests</h1>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <FaTrophy className="text-yellow-500" />
                        <span>Test & Assessment Center</span>
                    </div>
                </div>

                <Card>
                    {/* Tab Navigation */}
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
                        <button
                            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                                activeTab === 'available' 
                                    ? 'bg-primary text-white' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                            onClick={() => setActiveTab('available')}
                        >
                            <FaBook className="mr-2" />
                            Available Tests
                        </button>
                        <button
                            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                                activeTab === 'history' 
                                    ? 'bg-primary text-white' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                            onClick={() => setActiveTab('history')}
                        >
                            <FaHistory className="mr-2" />
                            Test History
                        </button>
                    </div>

                    {/* Available Tests Tab */}
                    {activeTab === 'available' && (
                        <div>
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Spinner size="lg" />
                                </div>
                            ) : availableTests.length > 0 ? (
                                <div className="space-y-4">
                                    {availableTests.map((test, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center mb-2">
                                                        <h3 className="text-xl font-semibold text-gray-800 mr-3">
                                                            {test.latestTopic}
                                                        </h3>
                                                        {test.isDefaultTopic && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                                General Topics
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                                        <div className="flex items-center">
                                                            <FaBook className="mr-2 text-blue-500" />
                                                            <span>{test.questions?.length || 0} Questions</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <FaClock className="mr-2 text-green-500" />
                                                            <span>{test.durationPerQuestion}s per question</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <FaClock className="mr-2 text-orange-500" />
                                                            <span>Total: {test.totalTestDuration < 100 
                                                                ? `${test.totalTestDuration} min (${test.totalTestDuration * 60} sec)` 
                                                                : formatTime(test.totalTestDuration)}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <FaAward className="mr-2 text-purple-500" />
                                                            <span>Test Assessment</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <Button
                                                        onClick={() => startTest(test)}
                                                        disabled={loading}
                                                        variant="primary"
                                                        size="lg"
                                                        className="min-w-32"
                                                    >
                                                        <FaPlay className="mr-2" />
                                                        Start Test
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {test.notification && (
                                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                    <p className="text-blue-800 text-sm flex items-center">
                                                        <FaBook className="mr-2" />
                                                        {test.notification}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="mb-4">
                                        <FaBook className="mx-auto text-gray-300 text-6xl mb-4" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Tests Available</h3>
                                    <p className="text-gray-500 max-w-md mx-auto">
                                        No tests have been assigned to you yet. Please check back later or contact your administrator.
                                    </p>
                                </div>
                            )}
                            
                            {/* View Scoreboard Button */}
                            <div className="mt-8 text-center">
                                <Button
                                    onClick={goToScoreboard}
                                    variant="secondary"
                                    className="flex items-center justify-center mx-auto"
                                >
                                    <FaChartBar className="mr-2" />
                                    View Scoreboard
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Test History Tab */}
                    {activeTab === 'history' && (
                        <div>
                            {/* Date Filter */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="date"
                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                    />
                                    <Button
                                        onClick={() => setSelectedDate('')}
                                        variant="outline"
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            {filteredTestHistory.length > 0 ? (
                                <div className="space-y-4">
                                    {filteredTestHistory.map((test, index) => {
                                        const percentage = test.totalQuestions > 0 
                                            ? Math.round((test.score / test.totalQuestions) * 100) 
                                            : 0;
                                        const getScoreColor = () => {
                                            if (percentage >= 80) return 'text-green-600 bg-green-100';
                                            if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
                                            return 'text-red-600 bg-red-100';
                                        };
                                        return (
                                            <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center mb-2">
                                                            <h3 className="text-lg font-semibold text-gray-800 mr-3">
                                                                {test.topic}
                                                            </h3>
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor()}`}>
                                                                {percentage}% Score
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600">
                                                            <div className="flex items-center">
                                                                <FaCalendarAlt className="mr-2 text-blue-500" />
                                                                <span>Completed on {new Date(test.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <FaBook className="mr-2 text-green-500" />
                                                                <span>{test.totalQuestions} Questions</span>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <FaTrophy className="mr-2 text-purple-500" />
                                                                <span>Score: {test.score}/{test.totalQuestions}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="ml-4 text-right">
                                                        <div className={`text-3xl font-bold ${percentage >= 70 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {percentage}%
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            Performance
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="mb-4">
                                        <FaHistory className="mx-auto text-gray-300 text-6xl mb-4" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Test History</h3>
                                    <p className="text-gray-500 max-w-md mx-auto">
                                        {selectedDate 
                                            ? 'No tests found for the selected date. Try another date or clear the filter.' 
                                            : 'You haven\'t completed any tests yet. Complete your first test to see your performance history here.'}
                                    </p>
                                </div>
                            )}
                            
                            {/* View Scoreboard Button */}
                            <div className="mt-8 text-center">
                                <Button
                                    onClick={goToScoreboard}
                                    variant="secondary"
                                    className="flex items-center justify-center mx-auto"
                                >
                                    <FaChartBar className="mr-2" />
                                    View Scoreboard
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    // Test interface (same as QuickTest but adapted for workers)
    if (step === 'test' && currentTest) {
        const currentQuestion = currentTest.questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / currentTest.questions.length) * 100;

        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold">{currentTest.latestTopic}</h1>
                            <p className="text-gray-300">Question {currentQuestionIndex + 1} of {currentTest.questions.length}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-300">Question Time</div>
                            <div className="text-2xl font-bold text-yellow-400">
                                <FaClock className="inline mr-2" />
                                {formatTime(timeLeft)}
                            </div>
                            <div className="text-sm text-gray-300 mt-2">Total Time: {formatTime(totalTimeLeft)}</div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-8">
                        <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    {/* Question */}
                    <div className="bg-gray-800 p-8 rounded-lg mb-8">
                        <h2 className="text-xl font-semibold mb-6">{currentQuestion.questionText}</h2>
                        
                        {/* Get the correct answer index only once */}
                        {(() => {
                            // Define correctAnswerIndex in a higher scope to be used throughout the component
                            const correctAnswerIndex = typeof currentQuestion.correctOption === 'number' 
                                ? currentQuestion.correctOption 
                                : (typeof currentQuestion.correctAnswer === 'number' ? currentQuestion.correctAnswer : 0);
                            
                            // Store it in a variable for debugging (for developers only)
                            // window.currentCorrectAnswerIndex = correctAnswerIndex;
                            
                            return (
                                <>
                                    <div className="space-y-4">
                                        {currentQuestion.options.map((option, index) => {
                                            // Determine styling based on the selected answer and feedback state
                                            let buttonStyle = 'border-gray-600 bg-gray-700 hover:border-blue-500 hover:bg-gray-600';
                                            let iconMarkup = null;
                                            
                                            // When showing feedback after answer selection
                                            if (showFeedback) {
                                                // Highlight the correct answer in green regardless of what was selected
                                                if (index === correctAnswerIndex) {
                                                    buttonStyle = 'border-green-500 bg-green-700 text-green-100';
                                                    iconMarkup = <span className="float-right text-green-400 font-bold">✓ CORRECT</span>;
                                                }
                                                
                                                // If this is the selected answer and it's wrong
                                                if (selectedAnswerIndex === index && index !== correctAnswerIndex) {
                                                    buttonStyle = 'border-orange-500 bg-orange-900 text-orange-100';
                                                    iconMarkup = <span className="float-right text-orange-400 font-bold">✗ WRONG</span>;
                                                }
                                            } 
                                            // When not showing feedback but an answer is selected
                                            else if (answers[currentQuestionIndex] === index) {
                                                buttonStyle = 'border-blue-500 bg-blue-900 text-blue-100 transform scale-105';
                                            }
                                            
                                            return (
                                                <button
                                                    key={index}
                                                    className={`w-full p-4 text-left rounded-lg border-2 transition-all duration-300 hover:scale-105 ${buttonStyle}`}
                                                    onClick={() => handleAnswerSelect(index)}
                                                    disabled={selectedAnswerIndex !== null || answers[currentQuestionIndex] !== null}
                                                >
                                                    <span className="font-medium mr-3">{String.fromCharCode(65 + index)}.</span>
                                                    {option}
                                                    {iconMarkup}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Feedback status */}
                                    <div className="flex justify-between items-center mt-6">
                                        <div className="text-sm">
                                            {showFeedback ? (
                                                selectedAnswerIndex === correctAnswerIndex ? (
                                                    <span className="text-green-400 font-medium">✓ Correct answer! Moving to next question in 2 seconds...</span>
                                                ) : (
                                                    <span className="text-orange-400 font-medium">
                                                        ✗ Incorrect. The correct answer is <span className="text-green-400 font-bold">
                                                            {String.fromCharCode(65 + correctAnswerIndex)}. 
                                                            {currentQuestion.options[correctAnswerIndex]}
                                                        </span>. Moving to next question...
                                                    </span>
                                                )
                                            ) : answers[currentQuestionIndex] !== null ? (
                                                <span className="text-blue-400">Answer selected</span>
                                            ) : (
                                                <span className="text-gray-400">Click an answer to continue</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Auto-advance enabled
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                </div>

                {/* Warning Modal */}
                <Modal
                    isOpen={showWarning}
                    onClose={() => {}}
                    title="⚠️ Fullscreen Exit Warning"
                >
                    <div className="text-center py-4">
                        <p className="text-gray-600 mb-4">
                            You have exited fullscreen mode. This is your <span className="font-bold">first warning</span>.
                        </p>
                        <p className="text-red-600 font-semibold mb-6">
                            If you exit fullscreen one more time, your test will be automatically submitted.
                        </p>
                        <div className="text-yellow-600 text-sm mb-4">
                            Warning count: <span className="font-bold">{fullscreenExits}/2</span>
                        </div>
                        <Button onClick={resumeTest} className="w-full">
                            Return to Test in Fullscreen
                        </Button>
                    </div>
                </Modal>
            </div>
        );
    }

    // Test Results
    if (step === 'result' && testResults) {
        const percentage = testResults.totalQuestions > 0 
            ? Math.round((testResults.score / testResults.totalQuestions) * 100) 
            : 0;

        return (
            <div className="min-h-screen bg-gray-100 py-8">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                        <div className="mb-6">
                            {/* Always show check mark for successful test completion */}
                            <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
                        </div>

                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Test Completed!</h1>
                        {testResults.message ? (
                            <p className="text-gray-600 mb-8">{testResults.message}</p>
                        ) : (
                            <p className="text-gray-600 mb-8">Great job, {user.name}!</p>
                        )}

                        <div className="bg-gray-50 p-6 rounded-lg mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <div className="text-3xl font-bold text-blue-600">{testResults.score}</div>
                                    <div className="text-sm text-gray-600">Correct Answers</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-purple-600">{testResults.totalQuestions}</div>
                                    <div className="text-sm text-gray-600">Total Questions</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-green-600">{percentage}%</div>
                                    <div className="text-sm text-gray-600">Score Percentage</div>
                                </div>
                            </div>
                        </div>

                        <div className="text-gray-600 mb-8">
                            <p>Redirecting to scoreboard in 5 seconds...</p>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                                <div 
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-5000"
                                    style={{ width: '100%' }}
                                ></div>
                            </div>
                        </div>

                        <Button onClick={backToDashboard} className="w-full">
                            Back to Tests
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Scoreboard
    if (step === 'scoreboard') {
        return (
            <div className="min-h-screen bg-gray-100 py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-bold text-gray-800">Scoreboard</h1>
                            <Button onClick={backToDashboard} variant="secondary">
                                Back to Tests
                            </Button>
                        </div>
                        
                        {/* Filters */}
                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter employee name..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="date"
                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                    />
                                    <Button
                                        onClick={() => setSelectedDate('')}
                                        variant="outline"
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </div>
                        
                        {scoreboardLoading ? (
                            <div className="flex justify-center py-12">
                                <Spinner size="lg" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Rank
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Employee
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Score
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Total Tests
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Percentage
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredScoreboard.length > 0 ? (
                                            filteredScoreboard.map((worker, index) => (
                                                <tr 
                                                    key={worker._id || worker.name} 
                                                    className={(worker._id === user._id || worker.worker?._id === user._id) ? "bg-blue-50 border-l-4 border-blue-500" : ""}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            {index === 0 && <span className="text-yellow-500 mr-2">🥇</span>}
                                                            {index === 1 && <span className="text-gray-400 mr-2">🥈</span>}
                                                            {index === 2 && <span className="text-amber-700 mr-2">🥉</span>}
                                                            <span>{index + 1}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-10 w-10">
                                                                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                                                    {worker.name?.charAt(0) || worker.worker?.name?.charAt(0) || 'U'}
                                                                </div>
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {worker.name || worker.worker?.name || 'Unknown'}
                                                                    {(worker._id === user._id || worker.worker?._id === user._id) && (
                                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                            You
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {worker.totalScore}/{worker.totalPossibleScore}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {worker.testCount} test{worker.testCount !== 1 ? 's' : ''}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {worker.percentage}%
                                                            </div>
                                                            <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                                                                <div 
                                                                    className={`h-2 rounded-full ${
                                                                        worker.percentage >= 80 ? 'bg-green-600' : 
                                                                        worker.percentage >= 60 ? 'bg-blue-600' : 
                                                                        worker.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-600'
                                                                    }`} 
                                                                    style={{ width: `${worker.percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                                                    No employees found matching your search criteria.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
    );
};

export default WorkerTest;