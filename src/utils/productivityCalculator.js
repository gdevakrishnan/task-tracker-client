export const calculateWorkerProductivity = (attendanceData, filterDate, filterRfid) => {
    // Filter data based on date and rfid
    const filteredData = attendanceData.filter(record => {
        const dateMatch = !filterDate || (record.date && record.date.split('T')[0] === filterDate);
        const rfidMatch = !filterRfid || record.rfid === filterRfid;
        return dateMatch && rfidMatch;
    });

    if (filteredData.length === 0) {
        return {
            total_working_minutes: 0,
            permission_minutes: 0,
            overtime_minutes: 0,
            lunch_break_minutes: 60,
            actual_working_minutes: 0,
            salary_deduction: 0,
            today_salary: 0,
            formatted_working_hours: "0hrs 0min",
            filtered_records: []
        };
    }

    // Get worker's per day salary from the first record
    const perDaySalary = filteredData[0]?.worker?.perDaySalary || 0;

    // Group records by date to handle multiple entries per day
    const recordsByDate = {};
    filteredData.forEach(record => {
        const date = record.date.split('T')[0];
        if (!recordsByDate[date]) {
            recordsByDate[date] = [];
        }
        recordsByDate[date].push(record);
    });

    let totalWorkingMinutes = 0;
    let totalPermissionMinutes = 0;
    let totalOvertimeMinutes = 0;

    Object.entries(recordsByDate).forEach(([date, records]) => {
        // Sort records by time for each day
        const sortedRecords = records.sort((a, b) => {
            const timeA = convertTo24Hour(a.time);
            const timeB = convertTo24Hour(b.time);
            return timeA.localeCompare(timeB);
        });

        // Find first IN and last OUT for the day
        const firstIn = sortedRecords.find(r => r.presence === true);
        const lastOut = sortedRecords.reverse().find(r => r.presence === false);

        if (firstIn && lastOut) {
            const inTime = convertTo24Hour(firstIn.time);
            const outTime = convertTo24Hour(lastOut.time);

            // Calculate working minutes for the day
            const dayCalculation = calculateDayWorkingHours(inTime, outTime);
            
            totalWorkingMinutes += dayCalculation.working_minutes;
            totalPermissionMinutes += dayCalculation.permission_minutes;
            totalOvertimeMinutes += dayCalculation.overtime_minutes;
        }
    });

    // Standard working hours (9 AM to 6 PM with 1 hour lunch break = 8 hours = 480 minutes)
    const standardWorkingMinutes = 480;
    const lunchBreakMinutes = 60;

    // Calculate actual working minutes (excluding lunch break)
    const actualWorkingMinutes = Math.max(0, totalWorkingMinutes - lunchBreakMinutes);

    // Calculate salary deduction based on shortfall
    const shortfallMinutes = Math.max(0, standardWorkingMinutes - actualWorkingMinutes);
    const salaryDeduction = (shortfallMinutes / standardWorkingMinutes) * perDaySalary;
    const todaySalary = perDaySalary - salaryDeduction;

    return {
        total_working_minutes: totalWorkingMinutes,
        permission_minutes: totalPermissionMinutes,
        overtime_minutes: totalOvertimeMinutes,
        lunch_break_minutes: lunchBreakMinutes,
        actual_working_minutes: actualWorkingMinutes,
        salary_deduction: Math.round(salaryDeduction * 100) / 100,
        today_salary: Math.round(todaySalary * 100) / 100,
        formatted_working_hours: formatMinutesToHours(actualWorkingMinutes),
        filtered_records: filteredData
    };
};

// Helper function to convert 12-hour format to 24-hour format
const convertTo24Hour = (time12h) => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes, seconds] = time.split(':');
    
    if (hours === '12') {
        hours = '00';
    }
    
    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds || '00'}`;
};

// Helper function to calculate working hours for a single day
const calculateDayWorkingHours = (inTime, outTime) => {
    const workingStartTime = '09:00:00'; // 9 AM
    const workingEndTime = '19:00:00';   // 7 PM
    const permissionEndTime = '09:15:00'; // 9:15 AM
    
    let workingMinutes = 0;
    let permissionMinutes = 0;
    let overtimeMinutes = 0;

    // Adjust in time if before 9 AM
    let adjustedInTime = inTime;
    if (inTime < workingStartTime) {
        adjustedInTime = workingStartTime;
    }

    // Adjust out time if after 7 PM
    let adjustedOutTime = outTime;
    if (outTime > workingEndTime) {
        adjustedOutTime = workingEndTime;
    }

    // Calculate permission minutes (9:00 AM to 9:15 AM)
    if (inTime > workingStartTime && inTime <= permissionEndTime) {
        const permissionStart = new Date(`1970-01-01T${workingStartTime}`);
        const actualIn = new Date(`1970-01-01T${inTime}`);
        permissionMinutes = (actualIn - permissionStart) / (1000 * 60);
    }

    // Calculate working minutes
    if (adjustedInTime < adjustedOutTime) {
        const inTimeDate = new Date(`1970-01-01T${adjustedInTime}`);
        const outTimeDate = new Date(`1970-01-01T${adjustedOutTime}`);
        workingMinutes = (outTimeDate - inTimeDate) / (1000 * 60);
    }

    return {
        working_minutes: workingMinutes,
        permission_minutes: permissionMinutes,
        overtime_minutes: overtimeMinutes
    };
};

// Helper function to format minutes to hours and minutes
const formatMinutesToHours = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}hrs ${mins}min`;
};