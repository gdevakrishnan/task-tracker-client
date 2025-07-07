import React, { Fragment, useRef, useState, useEffect, useContext } from 'react';
import { FaDownload, FaPlus } from 'react-icons/fa';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Webcam from "react-webcam";
import jsQR from "jsqr";
import appContext from '../../context/AppContext';
import { toast } from 'react-toastify';
import { putAttendance, getAttendance } from '../../services/attendanceService';
import Table from '../common/Table';
import Spinner from '../common/Spinner';
import { Link } from 'react-router-dom';


const AttendanceManagement = () => {
    const [worker, setWorker] = useState({ rfid: "" });
    const [qrText, setQrText] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [attendanceData, setAttendanceData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchName, setSearchName] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterRfid, setFilterRfid] = useState('');
    const webcamRef = useRef(null);
    const inputRef = useRef(null);
    const [isPunching, setIsPunching] = useState(false);
    
    const { subdomain } = useContext(appContext);
    const [confirmAction, setConfirmAction] = useState(null);

    const handleSubmit = e => {
        e.preventDefault();
        if (!subdomain || subdomain === 'main') {
          toast.error('Subdomain not found, check the URL.');
          return;
        }
        if (!worker.rfid.trim()) {
          toast.error('Enter the RFID');
          return;
        }
        let next = 'Punch In';
        const recs = attendanceData.filter(r => r.rfid === worker.rfid);
        if (recs.length) {
          const last = recs
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          next = last.presence ? 'Punch Out' : 'Punch In';
        }
        setConfirmAction(next);
      };
      
      const handleCancel = () => setConfirmAction(null);
      
      const handleConfirm = () => {
        setIsPunching(true);
        putAttendance({ rfid: worker.rfid, subdomain })
          .then(res => {
            toast.success(res.message || 'Attendance marked successfully!');
            setWorker({ rfid: '' });
            setConfirmAction(null);
            fetchAttendanceData();
          })
          .catch(err => {
            console.error(err);
            toast.error(err.message || 'Failed to mark attendance.');
          })
          .finally(() => {
            setIsPunching(false);
          });
      };

    
    useEffect(() => {
        const interval = setInterval(() => {
            scanQRCode();
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
              if (isModalOpen && inputRef.current) {
                inputRef.current.focus();
              }
            }, [isModalOpen]);

    useEffect(() => {
              
        if (isModalOpen && !confirmAction && inputRef.current) {
            inputRef.current.focus();
        }
    }, [confirmAction, isModalOpen]);        

    const scanQRCode = () => {
        if (webcamRef.current) {
            const video = webcamRef.current.video;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const context = canvas.getContext("2d");

                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height);

                if (code) {
                    setQrText(code.data);
                    console.log("QR Code Data:", code.data);
                    setWorker({ ...worker, rfid: code.data });
                }
            }
        }
    };

    const fetchAttendanceData = async () => {
        setIsLoading(true);
        try {
            const data = await getAttendance({ subdomain });
            console.log(data.attendance);
            setAttendanceData(Array.isArray(data.attendance) ? data.attendance : []);
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

      
      
   
// Replace the existing filteredAttendance variable with:
const filteredAttendance = attendanceData.filter(record => {
    const matchesName = !searchName || record?.name?.toLowerCase().includes(searchName.toLowerCase());
    const matchesDepartment = !filterDepartment || record?.departmentName?.toLowerCase().includes(filterDepartment.toLowerCase());
    const matchesDate = !filterDate || (record.date && record.date.startsWith(filterDate));
    const matchesRfid = !filterRfid || record?.rfid?.toLowerCase().includes(filterRfid.toLowerCase());
    return matchesName && matchesDepartment && matchesDate && matchesRfid;
});

const processedAttendance = processAttendanceByDay(filteredAttendance);

function processAttendanceByDay(attendanceData) {
    // Helper to parse "10:51:40 AM" to seconds from midnight
    function parseTime12hToSeconds(timeStr) {
        if (typeof timeStr !== 'string') return 0;
        const [time, modifier] = timeStr.trim().split(' ');
        if (!time) return 0;
        let [hours, minutes, seconds] = time.split(':').map(Number);
        hours = hours || 0;
        minutes = minutes || 0;
        seconds = seconds || 0;
        if (modifier && modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        else if (modifier && modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
        return hours * 3600 + minutes * 60 + seconds;
    }

    // Helper to parse "HH:mm:ss" duration to seconds
    function parseDurationToSeconds(durationStr) {
        if (typeof durationStr !== 'string') return 0;
        const [hours, minutes, seconds] = durationStr.split(':').map(Number);
        return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
    }

    // Helper to format seconds to "HH:mm:ss"
    function formatSecondsToDuration(totalSeconds) {
        if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
    }

    // Step 1: Create a map to hold all display data, grouped by employee and date
    const displayGroups = {};
    attendanceData.forEach(record => {
        const dateKey = new Date(record.date).toISOString().split('T')[0];
        const employeeKey = `${record.rfid || 'Unknown'}_${dateKey}`;
        if (!displayGroups[employeeKey]) {
            displayGroups[employeeKey] = {
                ...record,
                date: dateKey,
                inTimes: [],
                outTimes: [],
                duration: '00:00:00',
                latestTimestamp: 0,
            };
        }
        // Update latest timestamp for sorting
        displayGroups[employeeKey].latestTimestamp = Math.max(
            displayGroups[employeeKey].latestTimestamp,
            new Date(record.createdAt).getTime()
        );
        // Populate in/out times for display
        if (record.presence) {
            displayGroups[employeeKey].inTimes.push(record.time);
        } else {
            displayGroups[employeeKey].outTimes.push(record.time);
        }
    });

    // Step 2: Group punches by employee to process them chronologically
    const punchesByRfid = attendanceData.reduce((acc, record) => {
        const rfid = record.rfid || 'Unknown';
        if (!acc[rfid]) acc[rfid] = [];
        acc[rfid].push(record);
        return acc;
    }, {});

    // Step 3: Process each employee's punches to calculate valid durations
    for (const rfid in punchesByRfid) {
        // Sort this employee's punches by time
        const records = punchesByRfid[rfid].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const inPunchesStack = []; // Use a stack to find the most recent IN for an OUT
        
        for (const record of records) {
            if (record.presence) { // It's an IN punch
                inPunchesStack.push(record);
            } else { // It's an OUT punch
                if (inPunchesStack.length > 0) {
                    const lastIn = inPunchesStack.pop(); // Pair with the most recent IN
                    
                    const inDate = new Date(lastIn.date).toISOString().split('T')[0];
                    const outDate = new Date(record.date).toISOString().split('T')[0];

                    // Rule: Only calculate duration if it's a same-day pair
                    if (inDate === outDate) {
                        const inSeconds = parseTime12hToSeconds(lastIn.time);
                        const outSeconds = parseTime12hToSeconds(record.time);
                        
                        if (outSeconds > inSeconds) {
                            const duration = outSeconds - inSeconds;
                            const summaryKey = `${rfid}_${inDate}`;
                            
                            // Add the calculated duration to the correct display group
                            if (displayGroups[summaryKey]) {
                                const currentDurationSeconds = parseDurationToSeconds(displayGroups[summaryKey].duration);
                                displayGroups[summaryKey].duration = formatSecondsToDuration(currentDurationSeconds + duration);
                            }
                        }
                    }
                    // If it's an overnight punch, the IN is popped from the stack and ignored, fulfilling the rule.
                }
                // If no matching IN punch is on the stack, this OUT punch is ignored.
            }
        }
    }

    // Return the processed display groups, sorted by the latest activity
    return Object.values(displayGroups).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}
    // Function to download attendance data as CSV
    const downloadAttendanceCSV = () => {
        if (processedAttendance.length === 0) {
            toast.warning("No attendance data to download");
            return;
        }
    
        const headers = [
            'Name',
            'Employee ID (RFID)',
            'Department',
            'Date',
            'In Times',
            'Out Times',
            'Duration'
        ];
    
        const csvRows = processedAttendance.map(record => [
            record?.name || 'Unknown',
            record?.rfid || 'Unknown',
            record?.departmentName || 'Unknown',
            record.date || 'Unknown',
            record.inTimes.join(' | '),
            record.outTimes.join(' | '),
            record.duration || '00:00:00'
        ]);
    
        let csvContent = headers.join(',') + '\n';
        csvRows.forEach(row => {
            const formattedRow = row.map(cell => {
                if (cell === null || cell === undefined) return '';
                const cellString = String(cell);
                if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
                    return `"${cellString.replace(/"/g, '""')}"`;
                }
                return cellString;
            });
            csvContent += formattedRow.join(',') + '\n';
        });
    
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
    
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        link.setAttribute('download', `Attendance_Report_${formattedDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    
        toast.success("Attendance report downloaded successfully!");
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
                    <Link to={`/admin/attendance/${record.worker?._id}`} className="text-blue-600 hover:underline">
                        {record?.name || 'Unknown'}
                    </Link>
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
            render: (record) => record.date || 'Unknown'
        },
        {
            header: 'In Time',
            accessor: 'inTimes',
            render: (record) => (
                <div>
                    {record.inTimes.map((time, index) => (
                        <div key={index} className="text-green-600">{time}</div>
                    ))}
                </div>
            )
        },
        {
            header: 'Out Time',
            accessor: 'outTimes',
            render: (record) => (
                <div>
                    {record.outTimes.map((time, index) => (
                        <div key={index} className="text-red-600">{time}</div>
                    ))}
                </div>
            )
        },
        {
            header: 'Duration',
            accessor: 'duration',
            render: (record) => record.duration || '00:00:00'
        }
    ];


    return (
        <Fragment>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Attendance Management</h1>
                <div className='flex space-x-6 justify-center items-center'>
                    <Button
                        variant="primary"
                        className="flex items-center"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <FaPlus className="mr-2" />Attendance
                    </Button>
                    <Button
                        variant="primary"
                        className="flex items-center"
                        onClick={downloadAttendanceCSV}
                    >
                        <FaDownload className="mr-2" />Download
                    </Button>
                </div>
            </div>

            <div className='bg-white border rounded-lg p-4'>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search by name..."
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                    />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Filter by RFID..."
                        value={filterRfid}
                        onChange={(e) => setFilterRfid(e.target.value)}
                    />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Filter by department..."
                        value={filterDepartment}
                        onChange={(e) => setFilterDepartment(e.target.value)}
                    />
                    <input
                        type="date"
                        className="form-input"
                        placeholder="Filter by date..."
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Spinner size="md" variant="default" />
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={processedAttendance}
                        noDataMessage="No attendance records found."
                    />
                )}

                <Modal
                isOpen={isModalOpen}
                title="RFID Input & QR Scanner"
                size="md"
                onClose={() => {
                    setIsModalOpen(false);
                    setWorker({ rfid: '' });
                    setConfirmAction(null);
                }}
                >
                {confirmAction ? (
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                        <h2 className="text-xl font-semibold mb-4">
                        Do you want to{' '}
                        <span
                            className={
                            confirmAction === 'Punch In'
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                        >
                            {confirmAction}
                        </span>
                        ?
                        </h2>
                        <div className="flex justify-center space-x-4">
                        <Button variant="secondary" onClick={handleCancel} disabled={isPunching}>
                            cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleConfirm}
                            disabled={isPunching}
                            className="flex items-center justify-center"
                        >
                            {isPunching ? <Spinner size="sm" /> : confirmAction}
                        </Button>
                        </div>
                    </div>
                      
                    ) : (
                        <form onSubmit={handleSubmit} className="mb-4">
                        <input
                            ref={inputRef}
                            type="text"
                            value={worker.rfid}
                            onChange={e => setWorker({ rfid: e.target.value })}
                            placeholder="RFID"
                            className="border p-2 mb-2 w-full"
                        />
                        <Button type="submit" variant="primary" className="w-full">
                            Submit
                        </Button>
                        </form>
                    )}

                <Webcam
                    ref={webcamRef}
                    style={{ width: '100%', maxWidth: 400, margin: '0 auto', border: '1px solid #ddd' }}
                    videoConstraints={{ facingMode: 'environment' }}
                />
                {qrText && (
                    <div style={{ marginTop: 20 }}>
                    <h1 className="text-lg text-center">RFID: {qrText}</h1>
                    </div>
                )}
                </Modal>
            </div>
        </Fragment>
    );
};

export default AttendanceManagement;