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

const WorkerAttendance = () => {
    const { id } = useParams();
    const [attendanceData, setAttendanceData] = useState([]);
    const { subdomain } = useContext(appContext);
    const [isLoading, setIsLoading] = useState(true);
    const [filterDate, setFilterDate] = useState('');
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

        if (filterDate) {
            filtered = filtered.filter(item =>
                item.date && item.date.split('T')[0] === filterDate
            );
        }

        setFilteredByDateData(filtered);

        // Calculate productivity if both filters are applied
        if (filterDate) {
            const productivity = calculateWorkerProductivity(attendanceData, filterDate);
            setProductivityData(productivity);
        } else {
            setProductivityData(null);
        }
    }, [filterDate, attendanceData]);

    const handleReset = () => {
        setFilteredByDateData(attendanceData);
        setFilterDate('');
        setProductivityData(null);
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

    const ProductivityCard = ({ title, value, subtitle, icon: Icon, bgColor, textColor }) => (
        <div className={`${bgColor} rounded-lg p-6 shadow-md border`}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
                    <p className={`text-2xl font-bold ${textColor} mb-1`}>{value}</p>
                    {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-full ${textColor} bg-opacity-10`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );

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
                <input
                    type="date"
                    className="form-input w-60"
                    placeholder="Filter by date..."
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                />
                <Button
                    variant="primary"
                    className="flex items-center"
                    onClick={handleReset}
                >
                    <GrPowerReset className="mr-2" />Reset
                </Button>
            </div>

            {/* Productivity Cards */}
            {productivityData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <ProductivityCard
                        title="Working Hours"
                        value={productivityData.actual_working_minutes.toFixed(2)}
                        subtitle={productivityData.formatted_working_hours}
                        icon={FaClock}
                        bgColor="bg-blue-50"
                        textColor="text-blue-600"
                    />
                    <ProductivityCard
                        title="Permission Time"
                        value={productivityData.permission_minutes.toFixed(2)}
                        subtitle={`${Math.floor(productivityData.permission_minutes / 60)}hrs ${Math.round(productivityData.permission_minutes % 60)}min`}
                        icon={FaUserClock}
                        bgColor="bg-yellow-50"
                        textColor="text-yellow-600"
                    />
                    <ProductivityCard
                        title="Total Minutes"
                        value={productivityData.total_working_minutes.toFixed(2)}
                        subtitle={`${Math.floor(productivityData.total_working_minutes / 60)}hrs ${Math.round(productivityData.total_working_minutes % 60)}min`}
                        icon={FaCalculator}
                        bgColor="bg-purple-50"
                        textColor="text-purple-600"
                    />
                    <ProductivityCard
                        title="Today's Salary"
                        value={`₹${productivityData.today_salary.toFixed(2)}`}
                        subtitle={`Deduction: ₹${productivityData.salary_deduction}`}
                        icon={FaMoneyBillWave}
                        bgColor="bg-green-50"
                        textColor="text-green-600"
                    />
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <TaskSpinner size="md" variant="default" />
                </div>
            ) : (
                <Table
                    columns={columns}
                    data={filteredByDateData.reverse()}
                    noDataMessage="No attendance records found."
                />
            )}
        </Fragment>
    )
}

export default WorkerAttendance