export const calculateWorkerProductivity = (attendanceData, fromDate, toDate, options = {}) => {
  // Default options
  const {
    considerOvertime = false,
    deductSalary = true,
    workStartTime = '09:00:00',
    workEndTime = '19:00:00',
    lunchStartTime = '13:30:00',
    lunchEndTime = '14:30:00',
    permissionTimeMinutes = 15,
    salaryDeductionPerBreak = 10
  } = options;

  // Helper function to convert time string to minutes from midnight
  const timeToMinutes = (timeStr) => {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 60 + minutes + (seconds || 0) / 60;
  };

  // Helper function to convert minutes to time string
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to parse date string
  const parseDate = (dateStr) => {
    return new Date(dateStr);
  };

  // Helper function to check if date is within range
  const isDateInRange = (date, fromDate, toDate) => {
    const checkDate = new Date(date);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    return checkDate >= from && checkDate <= to;
  };

  // Filter attendance data by date range
  const filteredData = attendanceData.filter(record => 
    isDateInRange(record.date, fromDate, toDate)
  );

  if (filteredData.length === 0) {
    return {
      totalDays: 0,
      workingDays: 0,
      totalWorkingHours: 0,
      averageWorkingHours: 0,
      totalPermissionTime: 0,
      totalSalaryDeduction: 0,
      productivityPercentage: 0,
      dailyBreakdown: [],
      summary: {
        punctualityScore: 0,
        attendanceRate: 0,
        finalSalary: filteredData[0]?.worker?.finalSalary || 0
      }
    };
  }

  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const lunchStart = timeToMinutes(lunchStartTime);
  const lunchEnd = timeToMinutes(lunchEndTime);
  const standardWorkingMinutes = (workEnd - workStart) - (lunchEnd - lunchStart); // 9 hours - 1 hour lunch = 8 hours

  let totalWorkingMinutes = 0;
  let totalPermissionMinutes = 0;
  let totalSalaryDeduction = 0;
  let dailyBreakdown = [];
  let punctualityViolations = 0;

  // Get worker details from first record
  const worker = filteredData[0].worker;
  const perDaySalary = worker.perDaySalary || 0;
  const originalSalary = worker.salary || 0;

  filteredData.forEach(record => {
    const recordTime = timeToMinutes(record.time);
    const dayData = {
      date: record.date,
      punchTime: record.time,
      workingMinutes: 0,
      permissionMinutes: 0,
      salaryDeduction: 0,
      issues: []
    };

    let effectiveWorkStart = workStart;
    let effectiveWorkEnd = workEnd;
    let permissionTime = 0;
    let daySalaryDeduction = 0;

    // Handle late arrival (after 9:00 AM)
    if (recordTime > workStart) {
      const lateMinutes = recordTime - workStart;
      if (lateMinutes <= permissionTimeMinutes) {
        permissionTime += lateMinutes;
        dayData.issues.push(`Late arrival: ${Math.round(lateMinutes)} minutes (permission time)`);
      } else {
        permissionTime += permissionTimeMinutes;
        const excessLateMinutes = lateMinutes - permissionTimeMinutes;
        if (deductSalary && perDaySalary > 0) {
          daySalaryDeduction += Math.ceil(excessLateMinutes / permissionTimeMinutes) * salaryDeductionPerBreak;
          dayData.issues.push(`Excessive late arrival: ${Math.round(excessLateMinutes)} minutes beyond permission`);
        }
        punctualityViolations++;
      }
      effectiveWorkStart = recordTime;
    }

    // Handle early departure (before 7:00 PM)
    // Note: In the provided data, we only have punch-in times, not punch-out times
    // This logic would apply if we had punch-out times
    const assumedPunchOut = workEnd; // Assuming full day work for calculation

    // Handle lunch time violations
    if (recordTime > lunchStart && recordTime < lunchEnd) {
      const lunchViolationMinutes = Math.min(recordTime - lunchStart, lunchEnd - lunchStart);
      if (lunchViolationMinutes > 5) { // Grace period of 5 minutes
        const excessMinutes = lunchViolationMinutes - 5;
        if (deductSalary && perDaySalary > 0) {
          daySalaryDeduction += Math.ceil(excessMinutes / permissionTimeMinutes) * salaryDeductionPerBreak;
          dayData.issues.push(`Working during lunch: ${Math.round(excessMinutes)} minutes`);
        }
      }
    }

    // Calculate working minutes for the day
    let dayWorkingMinutes = 0;
    
    if (considerOvertime) {
      // Include all working hours including overtime
      dayWorkingMinutes = Math.max(0, assumedPunchOut - effectiveWorkStart - (lunchEnd - lunchStart));
    } else {
      // Only consider standard working hours (9 AM - 7 PM excluding lunch)
      const actualWorkStart = Math.max(effectiveWorkStart, workStart);
      const actualWorkEnd = Math.min(assumedPunchOut, workEnd);
      
      if (actualWorkEnd > actualWorkStart) {
        dayWorkingMinutes = actualWorkEnd - actualWorkStart;
        
        // Subtract lunch time if it falls within working hours
        if (actualWorkStart < lunchEnd && actualWorkEnd > lunchStart) {
          const lunchOverlap = Math.min(actualWorkEnd, lunchEnd) - Math.max(actualWorkStart, lunchStart);
          dayWorkingMinutes -= Math.max(0, lunchOverlap);
        }
      }
    }

    dayData.workingMinutes = Math.max(0, dayWorkingMinutes);
    dayData.permissionMinutes = permissionTime;
    dayData.salaryDeduction = daySalaryDeduction;

    totalWorkingMinutes += dayData.workingMinutes;
    totalPermissionMinutes += permissionTime;
    totalSalaryDeduction += daySalaryDeduction;
    dailyBreakdown.push(dayData);
  });

  // Calculate productivity metrics
  const totalDays = filteredData.length;
  const expectedTotalMinutes = totalDays * standardWorkingMinutes;
  const productivityPercentage = expectedTotalMinutes > 0 ? (totalWorkingMinutes / expectedTotalMinutes) * 100 : 0;
  const averageWorkingHours = totalDays > 0 ? (totalWorkingMinutes / totalDays) / 60 : 0;
  const punctualityScore = totalDays > 0 ? ((totalDays - punctualityViolations) / totalDays) * 100 : 0;
  const attendanceRate = 100; // Since we're only looking at days they were present

  // Calculate final salary after deductions
  let finalSalary = worker.finalSalary || originalSalary;
  if (deductSalary) {
    finalSalary = Math.max(0, (worker.finalSalary || originalSalary) - totalSalaryDeduction);
  }

  return {
    totalDays,
    workingDays: totalDays,
    totalWorkingHours: totalWorkingMinutes / 60,
    averageWorkingHours,
    totalPermissionTime: totalPermissionMinutes,
    totalSalaryDeduction,
    productivityPercentage: Math.round(productivityPercentage * 100) / 100,
    dailyBreakdown: dailyBreakdown.map(day => ({
      ...day,
      workingHours: day.workingMinutes / 60,
      permissionTime: day.permissionMinutes,
      workingTimeDisplay: minutesToTime(day.workingMinutes),
      permissionTimeDisplay: minutesToTime(day.permissionMinutes)
    })),
    summary: {
      punctualityScore: Math.round(punctualityScore * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      finalSalary,
      originalSalary,
      worker: {
        name: worker.name,
        username: worker.username,
        rfid: worker.rfid,
        department: worker.department,
        email: worker.email,
        perDaySalary: worker.perDaySalary
      }
    },
    configuration: {
      considerOvertime,
      deductSalary,
      workStartTime,
      workEndTime,
      lunchStartTime,
      lunchEndTime,
      permissionTimeMinutes,
      salaryDeductionPerBreak
    }
  };
};

// Example usage:
/*
const attendanceData = [
  // Your attendance data array
];

const productivity = calculateWorkerProductivity(
  attendanceData, 
  '2025-06-01', 
  '2025-06-02',
  {
    considerOvertime: false,
    deductSalary: true,
    permissionTimeMinutes: 15,
    salaryDeductionPerBreak: 10
  }
);

console.log('Worker Productivity Report:', productivity);
*/