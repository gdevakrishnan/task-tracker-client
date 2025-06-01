export const calculateWorkerProductivity = (attendanceData, fromDate = null, toDate = null, filterRfid = null) => {
    // Filter data based on date range and rfid
    const filteredData = attendanceData.filter(record => {
        if (!record.date) return false;
        
        const recordDate = record.date.split('T')[0];
        const rfidMatch = !filterRfid || record.rfid === filterRfid;
        
        let dateMatch = true;
        
        // Handle date range filtering
        if (fromDate && toDate) {
            dateMatch = recordDate >= fromDate && recordDate <= toDate;
        } else if (fromDate) {
            dateMatch = recordDate >= fromDate;
        } else if (toDate) {
            dateMatch = recordDate <= toDate;
        }
        
        return dateMatch && rfidMatch;
    });

    if (filteredData.length === 0) {
        return {
            total_working_minutes: 0,
            permission_minutes: 0,
            delay_minutes: 0,
            overtime_minutes: 0,
            lunch_break_minutes: 60,
            actual_working_minutes: 0,
            salary_deduction: 0,
            delay_deduction: 0,
            total_deduction: 0,
            today_salary: 0,
            total_salary: 0,
            working_days: 0,
            formatted_working_hours: "0hrs 0min",
            date_wise_breakdown: [],
            filtered_records: []
        };
    }

    // Get worker's per day salary from the first record
    const perDaySalary = filteredData[0]?.worker?.perDaySalary || 0;

    // Group records by date to handle multiple entries per day
    const recordsByDate = groupRecordsByDate(filteredData);

    let totalWorkingMinutes = 0;
    let totalPermissionMinutes = 0;
    let totalDelayMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalSalaryDeduction = 0;
    let totalDelayDeduction = 0;
    let totalSalary = 0;
    let workingDays = 0;
    const dateWiseBreakdown = [];

    // Process each date
    Object.entries(recordsByDate).forEach(([date, records]) => {
        const dayCalculation = calculateSingleDayProductivity(records, perDaySalary);
        
        if (dayCalculation.has_attendance) {
            totalWorkingMinutes += dayCalculation.total_working_minutes;
            totalPermissionMinutes += dayCalculation.permission_minutes;
            totalDelayMinutes += dayCalculation.delay_minutes;
            totalOvertimeMinutes += dayCalculation.overtime_minutes;
            totalSalaryDeduction += dayCalculation.salary_deduction;
            totalDelayDeduction += dayCalculation.delay_deduction;
            totalSalary += dayCalculation.day_salary;
            workingDays++;
            
            dateWiseBreakdown.push({
                date: date,
                ...dayCalculation
            });
        }
    });

    const totalDeduction = totalSalaryDeduction + totalDelayDeduction;

    return {
        total_working_minutes: Math.round(totalWorkingMinutes * 100) / 100,
        permission_minutes: Math.round(totalPermissionMinutes * 100) / 100,
        delay_minutes: Math.round(totalDelayMinutes * 100) / 100,
        overtime_minutes: Math.round(totalOvertimeMinutes * 100) / 100,
        lunch_break_minutes: 60,
        actual_working_minutes: Math.round((totalWorkingMinutes - (workingDays * 60)) * 100) / 100,
        salary_deduction: Math.round(totalSalaryDeduction * 100) / 100,
        delay_deduction: Math.round(totalDelayDeduction * 100) / 100,
        total_deduction: Math.round(totalDeduction * 100) / 100,
        today_salary: Math.round(totalSalary * 100) / 100,
        total_salary: Math.round(totalSalary * 100) / 100,
        working_days: workingDays,
        formatted_working_hours: formatMinutesToHours(totalWorkingMinutes - (workingDays * 60)),
        formatted_delay_hours: formatMinutesToHours(totalDelayMinutes),
        date_wise_breakdown: dateWiseBreakdown,
        filtered_records: filteredData
    };
};

// Group records by date
const groupRecordsByDate = (attendanceData) => {
    const recordsByDate = {};
    attendanceData.forEach(record => {
        const date = record.date.split('T')[0];
        if (!recordsByDate[date]) {
            recordsByDate[date] = [];
        }
        recordsByDate[date].push(record);
    });
    return recordsByDate;
};

// Calculate productivity for a single day
const calculateSingleDayProductivity = (dayRecords, perDaySalary) => {
    if (!dayRecords || dayRecords.length === 0) {
        return {
            has_attendance: false,
            first_in: null,
            last_out: null,
            total_working_minutes: 0,
            permission_minutes: 0,
            delay_minutes: 0,
            overtime_minutes: 0,
            lunch_break_minutes: 60,
            actual_working_minutes: 0,
            salary_deduction: perDaySalary,
            delay_deduction: 0,
            total_deduction: perDaySalary,
            day_salary: 0,
            formatted_hours: "0hrs 0min",
            formatted_delay_hours: "0hrs 0min"
        };
    }

    // Sort records by time
    const sortedRecords = dayRecords.sort((a, b) => {
        const timeA = convertTo24Hour(a.time);
        const timeB = convertTo24Hour(b.time);
        return timeA.localeCompare(timeB);
    });

    // Find first IN and last OUT for the day
    const firstIn = sortedRecords.find(r => r.presence === true);
    const lastOut = [...sortedRecords].reverse().find(r => r.presence === false);

    if (!firstIn || !lastOut) {
        return {
            has_attendance: false,
            first_in: firstIn?.time || null,
            last_out: lastOut?.time || null,
            total_working_minutes: 0,
            permission_minutes: 0,
            delay_minutes: 0,
            overtime_minutes: 0,
            lunch_break_minutes: 60,
            actual_working_minutes: 0,
            salary_deduction: perDaySalary,
            delay_deduction: 0,
            total_deduction: perDaySalary,
            day_salary: 0,
            formatted_hours: "0hrs 0min",
            formatted_delay_hours: "0hrs 0min"
        };
    }

    const inTime24 = convertTo24Hour(firstIn.time);
    const outTime24 = convertTo24Hour(lastOut.time);

    // Calculate day productivity with delay tracking
    const calculation = calculateDayWorkingHours(inTime24, outTime24);
    
    // Standard working hours (9 AM to 7 PM with 1 hour lunch = 9 hours total, 8 hours actual work)
    const standardWorkingMinutes = 480; // 8 hours actual work
    const lunchBreakMinutes = 60;
    
    // Calculate actual working minutes (total - lunch break)
    const actualWorkingMinutes = Math.max(0, calculation.working_minutes - lunchBreakMinutes);
    
    // Calculate salary deduction based on shortfall
    const shortfallMinutes = Math.max(0, standardWorkingMinutes - actualWorkingMinutes);
    const salaryDeduction = (shortfallMinutes / standardWorkingMinutes) * perDaySalary;
    
    // Calculate delay deduction (₹10 per delay > 15 minutes)
    const delayDeduction = calculation.delay_count * 10;
    
    // Calculate final day salary
    const totalDeduction = salaryDeduction + delayDeduction;
    const daySalary = Math.max(0, perDaySalary - totalDeduction);

    return {
        has_attendance: true,
        first_in: firstIn.time,
        last_out: lastOut.time,
        total_working_minutes: calculation.working_minutes,
        permission_minutes: calculation.permission_minutes,
        delay_minutes: calculation.delay_minutes,
        overtime_minutes: calculation.overtime_minutes,
        lunch_break_minutes: lunchBreakMinutes,
        actual_working_minutes: actualWorkingMinutes,
        salary_deduction: Math.round(salaryDeduction * 100) / 100,
        delay_deduction: Math.round(delayDeduction * 100) / 100,
        total_deduction: Math.round(totalDeduction * 100) / 100,
        day_salary: Math.round(daySalary * 100) / 100,
        formatted_hours: formatMinutesToHours(actualWorkingMinutes),
        formatted_delay_hours: formatMinutesToHours(calculation.delay_minutes),
        delay_count: calculation.delay_count
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

// Enhanced function to calculate working hours with delay tracking
const calculateDayWorkingHours = (inTime, outTime) => {
    const workingStartTime = '09:00:00'; // 9 AM
    const workingEndTime = '19:00:00';   // 7 PM
    const permissionGraceTime = '09:15:00'; // 9:15 AM (15 minutes grace period)
    
    let workingMinutes = 0;
    let permissionMinutes = 0;
    let delayMinutes = 0;
    let delayCount = 0;
    let overtimeMinutes = 0;

    // Convert times to Date objects for easier calculation
    const inTimeDate = new Date(`1970-01-01T${inTime}`);
    const outTimeDate = new Date(`1970-01-01T${outTime}`);
    const workStartDate = new Date(`1970-01-01T${workingStartTime}`);
    const workEndDate = new Date(`1970-01-01T${workingEndTime}`);
    const graceTimeDate = new Date(`1970-01-01T${permissionGraceTime}`);

    // Calculate delay and permission minutes (late arrival)
    if (inTimeDate > workStartDate) {
        const totalLateMinutes = (inTimeDate - workStartDate) / (1000 * 60);
        
        if (inTimeDate <= graceTimeDate) {
            // Within grace period (9:00 to 9:15) - 15 minutes permission, no delay
            permissionMinutes = 15;
            delayMinutes = 0;
            delayCount = 0;
        } else {
            // Late beyond grace period
            permissionMinutes = 15; // Base permission
            delayMinutes = totalLateMinutes - 15; // Delay time beyond grace period
            
            // Count delays > 15 minutes for salary deduction (₹10 each)
            if (delayMinutes > 0) {
                delayCount = Math.ceil(delayMinutes / 15); // Each 15-minute block counts as one delay
            }
        }
    }

    // Calculate early leaving permission and delays
    if (outTimeDate < workEndDate) {
        const earlyLeaveMinutes = (workEndDate - outTimeDate) / (1000 * 60);
        permissionMinutes += 15; // Add 15 minutes penalty for early leave
        
        // Add delay for early leaving if more than 15 minutes early
        if (earlyLeaveMinutes > 15) {
            const earlyDelayMinutes = earlyLeaveMinutes - 15;
            delayMinutes += earlyDelayMinutes;
            delayCount += Math.ceil(earlyDelayMinutes / 15);
        }
    }

    // Calculate total working minutes (from actual in to actual out)
    if (outTimeDate > inTimeDate) {
        workingMinutes = (outTimeDate - inTimeDate) / (1000 * 60);
    }

    // Overtime is not considered as per your requirement
    overtimeMinutes = 0;

    // Ensure working minutes don't exceed standard hours + lunch (10 hours max including lunch)
    const maxWorkingMinutes = 600; // 10 hours including lunch
    if (workingMinutes > maxWorkingMinutes) {
        workingMinutes = maxWorkingMinutes;
    }

    return {
        working_minutes: Math.round(workingMinutes * 100) / 100,
        permission_minutes: Math.round(permissionMinutes * 100) / 100,
        delay_minutes: Math.round(delayMinutes * 100) / 100,
        delay_count: delayCount,
        overtime_minutes: overtimeMinutes
    };
};

// Helper function to format minutes to hours and minutes
const formatMinutesToHours = (minutes) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.round(Math.abs(minutes) % 60);
    return `${hours}hrs ${mins}min`;
};

// Enhanced utility function to get date range productivity summary
export const getProductivitySummary = (attendanceData, fromDate, toDate, filterRfid = null) => {
    const productivity = calculateWorkerProductivity(attendanceData, fromDate, toDate, filterRfid);
    
    const summary = {
        total_days_in_range: calculateDaysInRange(fromDate, toDate),
        working_days: productivity.working_days,
        absent_days: calculateDaysInRange(fromDate, toDate) - productivity.working_days,
        average_daily_hours: productivity.working_days > 0 ? 
            formatMinutesToHours(productivity.actual_working_minutes / productivity.working_days) : "0hrs 0min",
        total_permission_hours: formatMinutesToHours(productivity.permission_minutes),
        total_delay_hours: formatMinutesToHours(productivity.delay_minutes),
        attendance_percentage: productivity.working_days > 0 ? 
            Math.round((productivity.working_days / calculateDaysInRange(fromDate, toDate)) * 100) : 0,
        total_delay_deduction: productivity.delay_deduction,
        ...productivity
    };
    
    return summary;
};

// Helper function to calculate total days in a date range
const calculateDaysInRange = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 1;
    
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    const timeDifference = endDate.getTime() - startDate.getTime();
    const dayDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
    
    return dayDifference;
};