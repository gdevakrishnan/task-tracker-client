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
import api from '../../hooks/useAxios';
import { getAuthToken } from '../../utils/authUtils';
import jsPDF from 'jspdf';

const WorkerAttendance = () => {
    const { id } = useParams();
    const [attendanceData, setAttendanceData] = useState([]);
    const { subdomain } = useContext(appContext);
    const [isLoading, setIsLoading] = useState(true);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [fiteredBatch, setFilteredBatch] = useState('');
    const [filteredByDateData, setFilteredByDateData] = useState([]);
    const [productivityData, setProductivityData] = useState(null);
    const [settingsData, setSettingsData] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        if (!subdomain || subdomain === 'main') {
            toast.error('Invalid subdomain. Please check the URL.');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const token = getAuthToken();
            const response = await api.get(`/settings/${subdomain}`, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
            const fetchedSettings = response.data;

            // Update state with fetched settings
            setSettingsData((prevSettings) => ({
                ...prevSettings,
                // Attendance and productivity settings
                considerOvertime: fetchedSettings.considerOvertime,
                deductSalary: fetchedSettings.deductSalary,
                permissionTimeMinutes: fetchedSettings.permissionTimeMinutes,
                salaryDeductionPerBreak: fetchedSettings.salaryDeductionPerBreak,
                batches: fetchedSettings.batches,
                intervals: fetchedSettings.intervals
            }));

            setFilteredBatch(fetchedSettings.batches[0].batchName);
        } catch (error) {
            console.error('Error fetching settings!', error);
            if (error.response?.status === 404) {
                // Settings not found, use defaults
                setOriginalSettings(settings);
            } else {
                toast.error('Failed to fetch settings');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!settingsData?.batches || !fiteredBatch) return;

        const selectedBatch = settingsData.batches.find(
            (batch) => batch.batchName === fiteredBatch
        );

        if (!selectedBatch) return;

        // Only update if values have changed
        if (
            settingsData.lunchFrom !== selectedBatch.lunchFrom ||
            settingsData.lunchTo !== selectedBatch.lunchTo ||
            settingsData.isLunchConsider !== selectedBatch.isLunchConsider
        ) {
            setSettingsData((prevSettings) => ({
                ...prevSettings,
                lunchFrom: selectedBatch.lunchFrom,
                lunchTo: selectedBatch.lunchTo,
                isLunchConsider: selectedBatch.isLunchConsider
            }));
        }
    }, [fiteredBatch, settingsData?.batches]);

    const downloadPDF = async (reportData) => {
        setIsGenerating(true);

        try {
            const doc = new jsPDF();

            // Helper function to clean currency values
            const cleanCurrencyValue = (value) => {
                if (typeof value === 'string') {
                    // Remove ₹ symbol and ¹ character, then add Rs. prefix
                    return value.replace(/₹/g, '').replace(/¹/g, '').replace(/Rs\./g, '').trim();
                }
                return value;
            };

            // Helper function to format currency
            const formatCurrency = (value) => {
                const cleanValue = cleanCurrencyValue(value);
                if (cleanValue && !isNaN(parseFloat(cleanValue))) {
                    return `Rs. ${cleanValue}`;
                }
                return cleanValue || 'Rs. 0';
            };

            // Set up colors and fonts
            const primaryColor = [0, 0, 0];
            const secondaryColor = [0, 0, 0];
            const lightGray = [0, 0, 0];
            const darkGray = [0, 0, 0];
            const header = [234, 241, 250];

            // Header
            doc.setFillColor(...header);
            doc.rect(0, 0, 210, 30, 'F');

            doc.setTextColor(37, 99, 235);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('Worker Productivity Report', 20, 20);

            // Worker Information
            let currentY = 40;
            doc.setTextColor(...secondaryColor);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');

            if (reportData.summary?.worker) {
                const worker = reportData.summary.worker;
                doc.text(`Employee: ${worker.name || 'N/A'}`, 20, currentY);
                doc.text(`Department: ${worker.department || 'N/A'}`, 20, currentY + 8);
                doc.text(`Email: ${worker.email || 'N/A'}`, 20, currentY + 16);
                currentY += 30;
            }

            // Summary Section
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('Final Summary', 20, currentY);
            doc.setFont('helvetica', 'normal');
            currentY += 10;

            // Create summary content with cleaned currency values
            const summaryEntries = Object.entries(reportData.finalSummary);
            doc.setFontSize(10);
            doc.setTextColor(...secondaryColor);

            summaryEntries.forEach(([key, value], index) => {
                const yPos = currentY + (index * 8);

                // Clean the value if it contains currency
                let displayValue = value;
                if (typeof value === 'string' && (value.includes('₹') || value.includes('¹') || value.includes('Rs.'))) {
                    displayValue = formatCurrency(value);
                }

                doc.text(`${key}: ${displayValue}`, 20, yPos);
            });

            currentY += (summaryEntries.length * 8) + 20;

            // Detailed Report Section
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('Detailed Daily Attendance Report', 20, currentY);
            currentY += 15;

            // Create table headers
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Date', 20, currentY);
            doc.text('In Time', 50, currentY);
            doc.text('Out Time', 80, currentY);
            doc.text('Worked Hours', 110, currentY);
            doc.text('Permission (mins)', 140, currentY);
            doc.text('Deduction', 180, currentY);

            currentY += 5;
            doc.line(20, currentY, 200, currentY); // Header line
            currentY += 5;

            // Add table data with cleaned currency values
            doc.setFont('helvetica', 'normal');
            reportData.report.forEach((row, index) => {
                if (currentY > 270) { // Check if we need a new page
                    doc.addPage();
                    currentY = 20;
                }

                // Clean the deduction value
                const cleanDeduction = row.deduction ? formatCurrency(row.deduction) : 'Rs. 0';

                doc.text(row.date || '', 20, currentY);
                doc.text(row.inTime || '', 50, currentY);
                doc.text(row.outTime || '', 80, currentY);
                doc.text(row.workedHours || '', 110, currentY);
                doc.text(row.permissionMins?.toString() || '0', 150, currentY);
                doc.text(cleanDeduction, 180, currentY);

                currentY += 8;
            });

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(...darkGray);
                doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 285);
                doc.text(`Page ${i} of ${pageCount}`, 170, 285);
            }

            // Save the PDF
            const fileName = `productivity_report_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

            toast.success('PDF generated successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Error generating PDF. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

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
            fetchSettings();
            fetchAttendanceData();
        }
    }, [subdomain]);

    // Replace the productivity calculation section in your useEffect:
    useEffect(() => {
        let filtered = attendanceData;

        // Filter by date range
        if (fromDate || toDate) {
            filtered = filtered.filter(item => {
                if (!item.date) return false;

                const itemDate = item.date.split('T')[0];

                if (fromDate && toDate) {
                    return itemDate >= fromDate && itemDate <= toDate;
                }
                else if (fromDate) {
                    return itemDate >= fromDate;
                }
                else if (toDate) {
                    return itemDate <= toDate;
                }

                return true;
            });
        }

        setFilteredByDateData(filtered);

        // Calculate productivity for the filtered date range
        if (fromDate && toDate && settingsData) {
            const productivityParameters = {
                attendanceData,
                fromDate,
                toDate,
                options: {
                    considerOvertime: settingsData.considerOvertime,
                    deductSalary: settingsData.deductSalary,
                    permissionTimeMinutes: settingsData.permissionTimeMinutes,
                    salaryDeductionPerBreak: settingsData.salaryDeductionPerBreak,
                    batches: settingsData.batches,
                    lunchFrom: settingsData.lunchFrom,
                    lunchTo: settingsData.lunchTo,
                    isLunchConsider: settingsData.isLunchConsider,
                    intervals: settingsData.intervals,
                    fiteredBatch: fiteredBatch
                }
            }

            const productivity = calculateWorkerProductivity(productivityParameters);
            setProductivityData(productivity);
        } else {
            setProductivityData(null);
        }
    }, [fromDate, toDate, attendanceData, settingsData, fiteredBatch]);

    const handleReset = () => {
        setFilteredByDateData(attendanceData);
        setFromDate('');
        setToDate('');
        setFilteredBatch('');
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

    const handleBatchChange = (e) => {
        setFilteredBatch(e.target.value);
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

                            alt="Employee"
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
                    <label className="text-sm font-medium text-gray-700">Batch:</label>
                    <select
                        value={fiteredBatch}
                        onChange={handleBatchChange}
                        className="form-input w-40 bg-white text-gray-700"
                    >
                        {settingsData?.batches?.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                {batch.batchName}
                            </option>
                        ))}
                    </select>
                </div>

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

                {/* Add download button here */}
                {productivityData && (
                    <Button
                        variant="success"
                        className="flex items-center"
                        onClick={() => downloadPDF({
                            finalSummary: productivityData.finalSummary,
                            report: productivityData.report,
                            summary: productivityData.summary
                        })}
                        disabled={isGenerating}
                    >
                        <FaMoneyBillWave className="mr-2" />
                        {isGenerating ? 'Generating...' : 'Download PDF'}
                    </Button>
                )}

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