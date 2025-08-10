// attendance _31/client/src/components/admin/SalaryManagement.jsx
import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';
import { FaDonate } from 'react-icons/fa';
import { FiRefreshCcw } from "react-icons/fi";
import { getWorkers } from '../../services/workerService';
import { getDepartments } from '../../services/departmentService';
import Card from '../common/Card';
import Button from '../common/Button';
import Table from '../common/Table';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';
import appContext from '../../context/AppContext';
import { giveBonusAmount, resetSalaryAmount } from '../../services/salaryService';

const SalaryManagement = () => {
    const [workers, setWorkers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
    const [formData, setFormData] = useState({
        bonus: '' // Changed to empty string to handle text input initially
    });

    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState(null);

    // Subdomain
    const { subdomain } = useContext(appContext);

    // Load workers and departments
    const loadData = async () => {
        setIsLoading(true);
        setIsLoadingDepartments(true);

        try {
            const [workersData, departmentsData] = await Promise.all([
                getWorkers({ subdomain }),
                getDepartments({ subdomain })
            ]);

            // Ensure data is an array
            const safeWorkersData = Array.isArray(workersData) ? workersData : [];
            const safeDepartmentsData = Array.isArray(departmentsData) ? departmentsData : [];

            setWorkers(safeWorkersData);
            setDepartments(safeDepartmentsData);
        } catch (error) {
            toast.error('Failed to load data');
            console.error(error);
            // Set to empty arrays in case of error
            setWorkers([]);
            setDepartments([]);
        } finally {
            setIsLoading(false);
            setIsLoadingDepartments(false);
        }
    };


    useEffect(() => {
        loadData();
    }, []);

    // Filter workers
    const filteredWorkers = Array.isArray(workers)
        ? workers.filter(
            worker =>
                worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (worker.department && worker.department.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : [];


    // Open edit worker modal
    const openEditModal = (worker) => {
        // Determine the correct department ID
        const departmentId = typeof worker.department === 'object'
            ? worker.department._id
            : (departments.find(dept => dept.name === worker.department)?._id || worker.department);

        setSelectedWorker(worker);
        setFormData({
            bonus: '' // Reset bonus amount when opening modal
        });
        setIsEditModalOpen(true);
    };

    // Handle edit worker
    const handleEditWorker = async (e) => {
        e.preventDefault();

        // Validate that bonus is a valid number
        const bonusAmount = parseFloat(formData.bonus);
        if (isNaN(bonusAmount) || bonusAmount < 0) { // Bonus should not be negative
            toast.error('Bonus amount must be a non-negative number.');
            return;
        }

        await giveBonusAmount({ id: selectedWorker._id, amount: bonusAmount }) // Use parsed bonusAmount
            .then((response) => {
                toast.success(response.message);
                loadData();
                setFormData({
                    bonus: '' // Reset to empty string after successful update
                });
                setIsEditModalOpen(false);
            })
            .catch((error) => {
                toast.error(error.message || 'Failed to give bonus');
            });
    };

    // Handle form input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        // Allow empty string or numbers to be typed
        if (value === '' || /^\d*\.?\d*$/.test(value)) { // Regex to allow only numbers and a single decimal point
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSalaryReset = async (e) => {
        e.preventDefault();
        await resetSalaryAmount({ subdomain })
            .then((response) => {
                toast.success(response.message);
                loadData();
            })
            .catch((error) => {
                toast.error(error.message || 'Failed to give bonus');
            });
    }

    // Table columns configuration
    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (record) => (
                <div className="flex items-center">
                    {record?.photo && (
                        <img
                            src={record.photo
                                ? record.photo
                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name)}`}

                            alt="Employee"
                            className="w-8 h-8 rounded-full mr-2"
                        />
                    )}
                    {record?.name || 'Unknown'}
                </div>
            )
        },
        {
            header: 'Salary',
            accessor: 'salary',
            render: (record) => record?.salary?.toFixed(2)
        },
        {
            header: 'Salary (this month)',
            accessor: 'finalSalary',
            render: (record) => record?.finalSalary?.toFixed(2)
        },
        {
            header: 'Employee ID',
            accessor: 'rfid'
        },
        {
            header: 'Department',
            accessor: 'department'
        },
        {
            header: 'Actions',
            accessor: 'actions',
            render: (worker) => (
                <div className="flex space-x-2">
                    <button
                        onClick={() => openEditModal(worker)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                    >
                        <FaDonate className='text-xl' />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Salary Management</h1>
                <Button
                    variant="primary"
                    className='flex items-center'
                    onClick={handleSalaryReset}
                >
                    <FiRefreshCcw className="mr-2" /> Reset Salary
                </Button>
            </div>

            <Card>
                <div className="mb-4">
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search by name or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Spinner size="lg" />
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={filteredWorkers}
                        noDataMessage="No employees found."
                    />
                )}
            </Card>

            {/* Edit Worker Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={'Give Bonus Amount'}
            >
                <form onSubmit={handleEditWorker}>
                    <div className="form-group">
                        <label htmlFor="bonus" className="form-label">Bonus Amount</label>
                        <input
                            type="text" // CHANGED: from "number" to "text"
                            id="bonus"
                            name="bonus"
                            className="form-input"
                            value={formData.bonus}
                            onChange={handleChange}
                            required
                            pattern="^\d*\.?\d*$" // ADDED: Pattern for client-side visual hint
                            title="Please enter a valid number (e.g., 100 or 50.50)" // ADDED: Title for pattern hint
                        />
                    </div>

                    <div className="flex justify-end mt-6 space-x-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                        >
                            Update Salary
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SalaryManagement;