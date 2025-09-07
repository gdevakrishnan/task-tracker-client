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
import { getHolidaysByDateRange } from '../../services/holidayService';

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

    // Updated downloadPDF function in WorkerAttendance.jsx
    // Replace the existing downloadPDF function with this updated version

    const downloadPDF = async (productivityData) => {
        setIsGenerating(true);

        try {
            const doc = new jsPDF();

            // Helper function to extract numeric value from currency string
            const extractNumericValue = (value) => {
                if (typeof value === 'string') {
                    // Remove any currency symbols, superscript characters, and commas but preserve decimal points
                    const cleanValue = value.replace(/[¹²³₹Rs,]/g, '').trim();
                    return parseFloat(cleanValue) || 0;
                }
                return value || 0;
            };

            // Helper function to format currency consistently with Rs. prefix
            const formatCurrency = (value) => {
                const numericValue = extractNumericValue(value);
                return `Rs. ${numericValue.toFixed(2)}`;
            };

            // Set up colors
            const primaryColor = [0, 0, 0];
            const secondaryColor = [100, 100, 100];
            const header = [234, 241, 250];
            const salaryColor = [37, 99, 235];
            const delayColor = [220, 38, 127]; // Pink for delays
            const normalColor = [34, 197, 94]; // Green for normal entries

            // Header
            doc.setFillColor(...header);
            doc.rect(0, 0, 210, 30, 'F');
            doc.setTextColor(37, 99, 235);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('Employee Detailed Attendance Report', 20, 20);

            // Worker Information
            let currentY = 40;
            doc.setTextColor(...secondaryColor);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');

            if (productivityData.summary?.worker) {
                const worker = productivityData.summary.worker;
                doc.text(`Employee: ${worker.name || 'Unknown Worker'}`, 20, currentY);
                doc.text(`Employee ID: ${worker.rfid || 'No ID'}`, 20, currentY + 8);
                doc.text(`Email: ${worker.email || 'No Email'}`, 20, currentY + 16);
                currentY += 30;
            }

            // Final Summary Section
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('Summary', 20, currentY);
            doc.setFont('helvetica', 'normal');
            currentY += 10;

            // Format all currency values consistently
            const absentDeduction = formatCurrency(productivityData.summary.absentDeduction || 0);
            const permissionDeduction = formatCurrency(productivityData.summary.permissionDeduction || 0);
            const totalDeduction = formatCurrency(productivityData.summary.totalSalaryDeduction || 0);
            const finalSalary = formatCurrency(productivityData.summary.finalSalary || 0);

            // Display summary data with consistent currency formatting
            doc.setFontSize(10);
            doc.setTextColor(...secondaryColor);

            const summaryData = [
                `Total Days in Period: ${productivityData.finalSummary["Total Days in Period"]}`,
                `Total Working Days: ${productivityData.finalSummary["Total Working Days"]}`,
                `Total Sundays: ${productivityData.finalSummary["Total Sundays"]}`,
                `Total Absent Days: ${productivityData.finalSummary["Total Absent Days"]}`,
                `Actual Working Days: ${productivityData.finalSummary["Actual Working Days"]}`,
                `Total Working Hours: ${productivityData.finalSummary["Total Working Hours"]}`,
                `Total Permission Time: ${productivityData.finalSummary["Total Permission Time"]}`,
                `Absent Deduction: ${absentDeduction}`,
                `Permission Deduction: ${permissionDeduction}`,
                `Total Salary Deductions: ${totalDeduction}`,
                `Attendance Rate: ${productivityData.finalSummary["Attendance Rate"]}`,
            ];

            summaryData.forEach((line, index) => {
                doc.text(line, 20, currentY + (index * 6));
            });

            // Final Salary (highlighted)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...salaryColor);
            doc.text(`Final Salary: ${finalSalary}`, 20, currentY + (summaryData.length * 6) + 10);

            currentY += (summaryData.length * 6) + 30;

            // Check if we need a new page
            if (currentY > 200) {
                doc.addPage();
                currentY = 20;
            }

            // Detailed Report Section
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('Detailed Daily Delay Report', 20, currentY);
            currentY += 15;

            // Table headers for detailed delay report
            doc.setFillColor(240, 240, 240);
            doc.rect(20, currentY - 5, 170, 10, 'F');
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);

            // Headers: Date - Out Time - In Time - Delay Time - Deduction Amount
            const headers = ['Date', 'Out Time', 'In Time', 'Delay Time', 'Type', 'Deduction'];
            const headerPositions = [22, 50, 75, 100, 125, 160];

            headers.forEach((header, index) => {
                doc.text(header, headerPositions[index], currentY);
            });

            currentY += 5;
            doc.line(20, currentY, 190, currentY);
            currentY += 10;

            // Detailed table data
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);

            // Group and sort report by date for better readability
            const sortedReport = [...productivityData.report].sort((a, b) => new Date(a.date) - new Date(b.date));

            sortedReport.forEach((record, index) => {
                if (currentY > 270) {
                    doc.addPage();
                    currentY = 20;

                    // Repeat headers on new page
                    doc.setFillColor(240, 240, 240);
                    doc.rect(20, currentY - 5, 170, 10, 'F');
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...primaryColor);

                    headers.forEach((header, index) => {
                        doc.text(header, headerPositions[index], currentY);
                    });

                    currentY += 5;
                    doc.line(20, currentY, 190, currentY);
                    currentY += 10;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                }

                // Alternate row colors
                if (index % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(20, currentY - 3, 170, 8, 'F');
                }

                // Set text color based on record type
                if (record.status === 'Delay' && record.delayTime !== '0 mins') {
                    doc.setTextColor(...delayColor); // Pink for delays
                } else if (record.status === 'Present') {
                    doc.setTextColor(...normalColor); // Green for normal attendance
                } else {
                    doc.setTextColor(...secondaryColor); // Gray for other statuses
                }

                // Format deduction value
                let deductionValue = '-';
                if (record.deductionAmount && record.deductionAmount !== '-') {
                    const numericValue = extractNumericValue(record.deductionAmount);
                    deductionValue = `Rs. ${numericValue.toFixed(2)}`;
                }

                // Truncate long delay types for better fit
                let delayType = record.delayType || '-';
                if (delayType.length > 12) {
                    delayType = delayType.substring(0, 12) + '...';
                }

                // Data columns: Date - Out Time - In Time - Delay Time - Type - Deduction Amount
                doc.text(record.date || '-', 22, currentY);
                doc.text(record.outTime || '-', 50, currentY);
                doc.text(record.inTime || '-', 75, currentY);
                doc.text(record.delayTime || '0 mins', 100, currentY);
                doc.text(delayType, 125, currentY);
                doc.text(deductionValue, 160, currentY);

                currentY += 8;
            });

            // Add legend
            currentY += 15;
            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...primaryColor);
            doc.text('Legend:', 20, currentY);
            currentY += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);

            // Legend items
            doc.setTextColor(...delayColor);
            doc.text('● Delay entries (Late arrival, Break delays, Early departure)', 22, currentY);
            currentY += 6;

            doc.setTextColor(...normalColor);
            doc.text('● Normal attendance (No delays)', 22, currentY);
            currentY += 6;

            doc.setTextColor(...secondaryColor);
            doc.text('● Special days (Sundays, Holidays, Absences)', 22, currentY);

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 285);
                doc.text(`Page ${i} of ${pageCount}`, 170, 285);
            }

            // Save PDF with descriptive filename
            const fileName = `detailed_attendance_report_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

            toast.success('Detailed PDF report generated successfully!');
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
        const calculateProductivity = async () => {
            let filtered = attendanceData;

            // Filter by date range
            if (fromDate || toDate) {
                filtered = filtered.filter(item => {
                    if (!item.date) return false;
                    const itemDate = item.date.split('T')[0];
                    if (fromDate && toDate) return itemDate >= fromDate && itemDate <= toDate;
                    else if (fromDate) return itemDate >= fromDate;
                    else if (toDate) return itemDate <= toDate;
                    return true;
                });
            }

            setFilteredByDateData(filtered);

            if (fromDate && toDate && settingsData) {
                try {
                    // ✅ Await holidays data
                    const holidaysData = await getHolidaysByDateRange(subdomain, fromDate, toDate);

                    console.log("Holidays Data:", holidaysData);

                    const productivityParameters = {
                        attendanceData: filtered,
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
                            fiteredBatch: fiteredBatch,
                            holidays: holidaysData || []  // ✅ pass holidays into calculator
                        }
                    };

                    const productivity = calculateWorkerProductivity(productivityParameters);
                    setProductivityData(productivity);
                } catch (err) {
                    console.error("Failed to fetch holidays:", err);
                    toast.error("Could not fetch holidays data.");
                }
            } else {
                setProductivityData(null);
            }
        };

        calculateProductivity();
    }, [fromDate, toDate, attendanceData, settingsData, fiteredBatch, subdomain]);

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
                        onClick={() => downloadPDF(productivityData)}
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