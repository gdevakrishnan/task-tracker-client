import React, { Fragment, useContext, useEffect, useState } from 'react'
import { FaChevronLeft, FaClock, FaMoneyBillWave, FaUserClock, FaCalculator } from 'react-icons/fa';
import { Link, useParams } from 'react-router-dom'
import Button from '../common/Button';
import appContext from '../../context/AppContext';
import { toast } from 'react-toastify';
import { getAttendance } from '../../services/attendanceService';
import Table from '../common/Table';
import TaskSpinner from '../common/Spinner';
import { GrPowerReset } from "react-icons/gr";
import { calculateWorkerProductivity } from '../../utils/productivityCalculator';
import ProductivityDisplay from './ProductivityDisplay';

const WorkerAttendance = () => {
    const { id } = useParams();
    const [attendanceData, setAttendanceData] = useState([]);
    const { subdomain } = useContext(appContext);
    const [isLoading, setIsLoading] = useState(true);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [filteredByDateData, setFilteredByDateData] = useState([]);
    const [productivityData, setProductivityData] = useState(null);

    const fetchAttendanceData = async () => {
        setIsLoading(true);
        try {
            const data = await getAttendance({ subdomain });

            const filteredData = Array.isArray(data.attendance)
                ? data.attendance.filter(item => item.worker?._id === id)
                : [];

            console.log(filteredData);
            setAttendanceData(filteredData);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch attendance data.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (subdomain && subdomain !== 'main') {
            fetchAttendanceData();
        }
    }, [subdomain]);

    useEffect(() => {
        let filtered = attendanceData;

        // Filter by date range
        if (fromDate || toDate) {
            filtered = filtered.filter(item => {
                if (!item.date) return false;

                const itemDate = item.date.split('T')[0];

                // If both dates are provided
                if (fromDate && toDate) {
                    return itemDate >= fromDate && itemDate <= toDate;
                }
                // If only from date is provided
                else if (fromDate) {
                    return itemDate >= fromDate;
                }
                // If only to date is provided
                else if (toDate) {
                    return itemDate <= toDate;
                }

                return true;
            });
        }
        console.log(filtered);

        setFilteredByDateData(filtered);

        // Calculate productivity for the filtered date range
        if (fromDate || toDate) {
            const productivity = calculateWorkerProductivity(
                attendanceData,
                fromDate,
                toDate,
                {
                    considerOvertime: false,
                    deductSalary: true,
                    permissionTimeMinutes: 15,
                    salaryDeductionPerBreak: 10
                }
            );
            setProductivityData(productivity);
        } else {
            setProductivityData(null);
        }
    }, [fromDate, toDate, attendanceData]);

    const handleReset = () => {
        setFilteredByDateData(attendanceData);
        setFromDate('');
        setToDate('');
        setProductivityData(null);
    };

    // Validation to ensure from date is not greater than to date
    const handleFromDateChange = (e) => {
        const newFromDate = e.target.value;
        if (toDate && newFromDate > toDate) {
            toast.error("From date cannot be greater than To date");
            return;
        }
        setFromDate(newFromDate);
    };

    const handleToDateChange = (e) => {
        const newToDate = e.target.value;
        if (fromDate && newToDate < fromDate) {
            toast.error("To date cannot be less than From date");
            return;
        }
        setToDate(newToDate);
    };

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

                            alt="Worker"
                            className="w-8 h-8 rounded-full mr-2"
                        />
                    )}
                    {record?.name || 'Unknown'}
                </div>
            )
        },
        {
            header: 'Employee ID',
            accessor: 'rfid',
            render: (record) => record?.rfid || 'Unknown'
        },
        {
            header: 'Department',
            accessor: 'departmentName',
            render: (record) => record?.departmentName || 'Unknown'
        },
        {
            header: 'Date',
            accessor: 'date',
            render: (record) => record.date ? record.date.split('T')[0] : 'Unknown'
        },
        {
            header: 'Time',
            accessor: 'time',
            render: (record) => record.time || 'Unknown'
        },
        {
            header: 'Presence',
            accessor: 'presence',
            render: (record) => record.presence ? <p className='text-green-600'>IN</p> : <p className='text-red-600'>OUT</p>
        }
    ];

    return (
        <Fragment>
            <div className="flex justify-between items-center mb-6 mt-4">
                <h1 className="text-2xl font-bold">Attendance Report</h1>
                <div className="flex justify-end space-x-4 items-center mb-6">
                    <Link to={'/admin/attendance'}>
                        <Button
                            variant="primary"
                            className="flex items-center"
                        >
                            <FaChevronLeft className="mr-2" />Back
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex justify-end space-x-4 items-center mb-6">
                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">From:</label>
                    <input
                        type="date"
                        className="form-input w-40"
                        placeholder="From date..."
                        value={fromDate}
                        onChange={handleFromDateChange}
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">To:</label>
                    <input
                        type="date"
                        className="form-input w-40"
                        placeholder="To date..."
                        value={toDate}
                        onChange={handleToDateChange}
                    />
                </div>
                <Button
                    variant="primary"
                    className="flex items-center"
                    onClick={handleReset}
                >
                    <GrPowerReset className="mr-2" />Reset
                </Button>
            </div>

            {/* Date Range Display */}
            {(fromDate || toDate) && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                        <strong>Filtered Period:</strong>
                        {fromDate && toDate ? ` ${fromDate} to ${toDate}` :
                            fromDate ? ` From ${fromDate} onwards` :
                                ` Up to ${toDate}`}
                        <span className="ml-4 text-blue-600">
                            ({filteredByDateData.length} record{filteredByDateData.length !== 1 ? 's' : ''} found)
                        </span>
                    </p>
                </div>
            )}

            {/* Productivity Cards */}
            {productivityData && (
                <ProductivityDisplay productivityData={productivityData} />
            )}

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <TaskSpinner size="md" variant="default" />
                </div>
            ) : (
                <Table
                    columns={columns}
                    data={[...filteredByDateData].reverse()}
                    noDataMessage="No attendance records found for the selected date range."
                />
            )}
        </Fragment>
    )
}

export default WorkerAttendance