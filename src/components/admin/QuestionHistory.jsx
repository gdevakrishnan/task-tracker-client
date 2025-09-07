// Test Management - Question History Component
import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { getWorkers } from '../../services/workerService';
import appContext from '../../context/AppContext';
import Button from '../common/Button';
import Table from '../common/Table';
import Card from '../common/Card';
import Spinner from '../common/Spinner';
import { FaSearch, FaCalendarAlt, FaUser, FaDownload, FaEye, FaFilter } from 'react-icons/fa';

const QuestionHistory = () => {
    const { subdomain } = useContext(appContext);
    const [questions, setQuestions] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        workerId: '',
        topic: '',
        date: ''
    });

    useEffect(() => {
        fetchWorkers();
        fetchQuestions();
    }, []);

    useEffect(() => {
        fetchQuestions();
    }, [filters]);

    const fetchWorkers = async () => {
        try {
            const workersData = await getWorkers({ subdomain });
            setWorkers(workersData || []);
        } catch (error) {
            console.error('Error fetching workers:', error);
        }
    };

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.workerId) params.append('workerId', filters.workerId);
            if (filters.topic) params.append('topic', filters.topic);
            if (filters.date) params.append('date', filters.date);

            const response = await api.get(`/test/questions?${params.toString()}`);
            setQuestions(response.data.questions || []);
        } catch (error) {
            console.error('Error fetching questions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const clearFilters = () => {
        setFilters({
            workerId: '',
            topic: '',
            date: ''
        });
    };

    const exportQuestions = () => {
        const csvContent = [
            ['Worker Name', 'Topic', 'Question Text', 'Difficulty', 'Created Date'].join(','),
            ...questions.map(q => [
                q.worker?.name || 'Unknown Worker',
                q.topic,
                `"${q.questionText.replace(/"/g, '""')}"`,
                q.difficulty,
                new Date(q.createdAt).toLocaleDateString()
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `questions_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = [
        {
            key: 'worker.name',
            title: 'Worker',
            render: (question) => (
                <div>
                    <div className="font-medium text-gray-800">
                        {question.worker?.name || 'Unknown Worker'}
                    </div>
                    {question.worker?.departmentName ? (
                        <div className="text-sm text-gray-500">
                            {question.worker.departmentName}
                        </div>
                    ) : (
                        question.worker?.department ? (
                            <div className="text-sm text-gray-500">
                                {question.worker.department}
                            </div>
                        ) : null
                    )}
                </div>
            )
        },
        {
            key: 'topic',
            title: 'Topic',
            render: (question) => (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {question.topic}
                </span>
            )
        },
        {
            key: 'questionText',
            title: 'Question',
            render: (question) => (
                <div className="max-w-xs">
                    <div className="truncate font-medium">
                        {question.questionText}
                    </div>
                    <div className="text-sm text-gray-500">
                        {question.options?.length || 0} options
                    </div>
                </div>
            )
        },
        {
            key: 'difficulty',
            title: 'Difficulty',
            render: (question) => {
                const colors = {
                    Easy: 'bg-green-100 text-green-800',
                    Medium: 'bg-yellow-100 text-yellow-800',
                    Hard: 'bg-red-100 text-red-800'
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-sm ${colors[question.difficulty] || 'bg-gray-100 text-gray-800'}`}>
                        {question.difficulty}
                    </span>
                );
            }
        },
        {
            key: 'timeDuration',
            title: 'Time (sec)',
            render: (question) => (
                <span className="text-gray-600">
                    {question.timeDuration || 15}s
                </span>
            )
        },
        {
            key: 'createdAt',
            title: 'Created',
            render: (question) => (
                <div className="text-sm text-gray-600">
                    {new Date(question.createdAt).toLocaleDateString()}
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Question History</h2>
                    <Button
                        onClick={exportQuestions}
                        disabled={!questions.length}
                        variant="outline"
                    >
                        <FaDownload className="mr-2" />
                        Export CSV
                    </Button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Worker
                        </label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={filters.workerId}
                            onChange={(e) => handleFilterChange('workerId', e.target.value)}
                        >
                            <option value="">All Workers</option>
                            {workers.map(worker => (
                                <option key={worker._id} value={worker._id}>
                                    {worker.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Topic
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Search by topic..."
                            value={filters.topic}
                            onChange={(e) => handleFilterChange('topic', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date
                        </label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={filters.date}
                            onChange={(e) => handleFilterChange('date', e.target.value)}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            onClick={clearFilters}
                            variant="outline"
                            className="w-full"
                        >
                            Clear Filters
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                            <div className="text-sm text-gray-600">Total Questions</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-600">
                                {new Set(questions.map(q => q.worker?._id)).size}
                            </div>
                            <div className="text-sm text-gray-600">Unique Workers</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-purple-600">
                                {new Set(questions.map(q => q.topic)).size}
                            </div>
                            <div className="text-sm text-gray-600">Unique Topics</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-orange-600">
                                {questions.filter(q => 
                                    new Date(q.createdAt).toDateString() === new Date().toDateString()
                                ).length}
                            </div>
                            <div className="text-sm text-gray-600">Today's Questions</div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={questions}
                        emptyMessage="No questions found. Generate some questions first."
                    />
                )}
            </div>
        </div>
    );
};

export default QuestionHistory;