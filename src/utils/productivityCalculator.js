export const calculateWorkerProductivity = (productivityParameters) => {
  const {
    attendanceData,
    fromDate,
    toDate,
    options = {}
  } = productivityParameters;

  const {
    considerOvertime = false,
    deductSalary = true,
    permissionTimeMinutes = 15,
    salaryDeductionPerBreak = 10,
    batches = [],
    lunchFrom = '12:00',
    lunchTo = '13:00',
    intervals = [],
    fiteredBatch = 'Full Time'
  } = options;

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return hours * 60 + minutes + seconds / 60;
  };

  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const parseAttendanceTime = (timeStr) => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(' ');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    let totalMinutes = minutes + (seconds || 0) / 60;
    if (period === 'AM') {
      totalMinutes += (hours === 12 ? 0 : hours) * 60;
    } else if (period === 'PM') {
      totalMinutes += (hours === 12 ? 12 : hours + 12) * 60;
    } else {
      totalMinutes += hours * 60;
    }
    return totalMinutes;
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    return `${day.toString().padStart(2, '0')} ${month}`;
  };

  const isSunday = (date) => {
    const day = new Date(date);
    return day.getDay() === 0; // Sunday is 0
  };

  const generateDateRange = (fromDate, toDate) => {
    const dates = [];
    const currentDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  const countSundaysInRange = (fromDate, toDate) => {
    const dates = generateDateRange(fromDate, toDate);
    return dates.filter(date => isSunday(date)).length;
  };

  const isSingleDay = new Date(fromDate).toDateString() === new Date(toDate).toDateString();

  const selectedBatch = batches.find(batch => batch.batchName === fiteredBatch);
  const workStartTime = selectedBatch ? selectedBatch.from : '09:00';
  const workEndTime = selectedBatch ? selectedBatch.to : '19:00';

  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const lunchStart = timeToMinutes(lunchFrom);
  const lunchEnd = timeToMinutes(lunchTo);

  let standardWorkingMinutes = workEnd - workStart;
  standardWorkingMinutes -= (lunchEnd - lunchStart);
  intervals.forEach(interval => {
    const intervalStart = timeToMinutes(interval.from);
    const intervalEnd = timeToMinutes(interval.to);
    standardWorkingMinutes -= (intervalEnd - intervalStart);
  });

  const filteredData = attendanceData.filter(record => {
    const recordDate = new Date(record.date);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    recordDate.setHours(0, 0, 0, 0);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return recordDate >= from && recordDate <= to;
  });

  if (filteredData.length === 0 && isSingleDay) {
    return { ...emptyResponse() };
  }

  const worker = filteredData.length > 0 ? (filteredData[0].worker || {}) : {};
  const originalSalary = worker.salary || 0;

  // Calculate working days for the given period
  const allDates = generateDateRange(fromDate, toDate);
  const totalDaysInPeriod = allDates.length;
  const totalSundaysInPeriod = countSundaysInRange(fromDate, toDate);
  const totalWorkingDaysInPeriod = totalDaysInPeriod - totalSundaysInPeriod;

  // Calculate per day and per minute salary based on working days in the period
  const perDaySalary = totalWorkingDaysInPeriod > 0 ? originalSalary / totalWorkingDaysInPeriod : 0;
  const perMinuteSalary = standardWorkingMinutes > 0 ? perDaySalary / standardWorkingMinutes : 0;
  const totalExpectedMinutes = totalWorkingDaysInPeriod * standardWorkingMinutes;

  let totalWorkingMinutes = 0;
  let totalPermissionMinutes = 0;
  let dailyBreakdown = [];
  let punctualityViolations = 0;
  let report = [];
  let totalAbsentDays = 0;
  let totalSundayCount = 0;

  // Group attendance data by date
  const groupedByDate = {};
  filteredData.forEach(record => {
    const dateKey = new Date(record.date).toDateString();
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(record);
  });

  const processDay = (punches, date) => {
    const dayData = {
      date,
      punchTime: punches.length === 1 ? punches[0].originalTime : `${punches[0].originalTime} - ${punches[punches.length - 1].originalTime}`,
      workingMinutes: 0,
      permissionMinutes: 0,
      salaryDeduction: 0,
      issues: []
    };

    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];

    let effectiveWorkStart = Math.max(firstPunch.time, workStart);
    let effectiveWorkEnd = punches.length > 1 ? Math.min(lastPunch.time, workEnd) : workEnd;
    let permissionTime = 0;

    if (firstPunch.time > workStart) {
      const lateMinutes = firstPunch.time - workStart;
      if (lateMinutes <= permissionTimeMinutes) {
        permissionTime += lateMinutes;
        dayData.issues.push(`Late arrival: ${Math.round(lateMinutes)} minutes (within permission)`);
      } else {
        permissionTime += permissionTimeMinutes;
        const excessLateMinutes = lateMinutes - permissionTimeMinutes;
        punctualityViolations++;
        dayData.issues.push(`Excessive late arrival: ${Math.round(excessLateMinutes)} minutes`);
      }
    }

    if (lastPunch.time < workEnd && punches.length > 1) {
      const earlyMinutes = workEnd - lastPunch.time;
      if (earlyMinutes > permissionTimeMinutes) {
        const excessEarlyMinutes = earlyMinutes - permissionTimeMinutes;
        dayData.issues.push(`Early departure: ${Math.round(excessEarlyMinutes)} minutes`);
      }
    }

    let dayWorkingMinutes = effectiveWorkEnd > effectiveWorkStart ? effectiveWorkEnd - effectiveWorkStart : 0;

    // Subtract lunch time only if isLunchConsider is false
    if (!options.isLunchConsider && effectiveWorkStart < lunchEnd && effectiveWorkEnd > lunchStart) {
      const overlap = Math.min(effectiveWorkEnd, lunchEnd) - Math.max(effectiveWorkStart, lunchStart);
      dayWorkingMinutes -= Math.max(0, overlap);
    }

    // Subtract only intervals where isBreakConsider is false
    intervals.forEach(interval => {
      if (!interval.isBreakConsider) {
        const start = timeToMinutes(interval.from);
        const end = timeToMinutes(interval.to);
        if (effectiveWorkStart < end && effectiveWorkEnd > start) {
          const overlap = Math.min(effectiveWorkEnd, end) - Math.max(effectiveWorkStart, start);
          dayWorkingMinutes -= Math.max(0, overlap);
        }
      }
    });

    dayData.workingMinutes = Math.max(0, dayWorkingMinutes);
    dayData.permissionMinutes = permissionTime;
    dayData.salaryDeduction = permissionTime * perMinuteSalary;

    // Create report entry
    const reportEntry = {
      date: formatDate(date),
      inTime: formatTime(firstPunch.time),
      outTime: punches.length > 1 ? formatTime(lastPunch.time) : '-',
      workedHours: (dayData.workingMinutes / 60).toFixed(2) + ' hrs',
      permissionMins: Math.round(permissionTime),
      deduction: formatCurrency(dayData.salaryDeduction),
      status: 'Present'
    };

    report.push(reportEntry);
    totalWorkingMinutes += dayData.workingMinutes;
    totalPermissionMinutes += permissionTime;
    dailyBreakdown.push(dayData);
  };

  const processMissedDay = (date) => {
    const dateString = date.toISOString().split('T')[0];
    const isSundayDay = isSunday(date);
    
    if (isSundayDay) {
      totalSundayCount++;
      // Sunday - mark as '-' for everything
      const dayData = {
        date: dateString,
        punchTime: '-',
        workingMinutes: 0,
        permissionMinutes: 0,
        salaryDeduction: 0,
        issues: ['Sunday - Weekly off']
      };

      const reportEntry = {
        date: formatDate(dateString),
        inTime: '-',
        outTime: '-',
        workedHours: '-',
        permissionMins: '-',
        deduction: '-',
        status: 'Sunday'
      };

      report.push(reportEntry);
      dailyBreakdown.push(dayData);
    } else {
      totalAbsentDays++;
      // Working day absent - deduct one day salary
      const dayData = {
        date: dateString,
        punchTime: 'Absent',
        workingMinutes: 0,
        permissionMinutes: 0,
        salaryDeduction: perDaySalary,
        issues: ['Absent - Full day salary deducted']
      };

      const reportEntry = {
        date: formatDate(dateString),
        inTime: 'Absent',
        outTime: 'Absent',
        workedHours: '0 hrs',
        permissionMins: 0,
        deduction: formatCurrency(perDaySalary),
        status: 'Absent'
      };

      report.push(reportEntry);
      dailyBreakdown.push(dayData);
    }
  };

  // Process all dates in the range
  allDates.forEach(date => {
    const dateKey = date.toDateString();
    const dateString = date.toISOString().split('T')[0];
    
    if (groupedByDate[dateKey]) {
      // Date has attendance data
      const punches = groupedByDate[dateKey].map(record => ({
        time: parseAttendanceTime(record.time),
        originalTime: record.time,
        record
      })).sort((a, b) => a.time - b.time);
      
      if (punches.length > 0) {
        processDay(punches, dateString);
      }
    } else {
      // Date is missed - check if Sunday or absent
      processMissedDay(date);
    }
  });

  const totalDays = dailyBreakdown.length;
  const actualWorkingDays = totalWorkingDaysInPeriod - totalAbsentDays;
  const productivityPercentage = totalExpectedMinutes > 0 ? (totalWorkingMinutes / totalExpectedMinutes) * 100 : 0;
  const averageWorkingHours = actualWorkingDays > 0 ? (totalWorkingMinutes / actualWorkingDays) / 60 : 0;
  const punctualityScore = actualWorkingDays > 0 ? ((actualWorkingDays - punctualityViolations) / actualWorkingDays) * 100 : 0;
  const attendanceRate = totalWorkingDaysInPeriod > 0 ? (actualWorkingDays / totalWorkingDaysInPeriod) * 100 : 0;

  // Calculate salary components
  const salaryFromWorkingMinutes = totalWorkingMinutes * perMinuteSalary;
  const totalAbsentDeduction = totalAbsentDays * perDaySalary;
  const totalPermissionDeduction = totalPermissionMinutes * perMinuteSalary;
  const totalSalaryDeduction = totalAbsentDeduction + totalPermissionDeduction;

  // Final salary calculation
  const finalSalary = Math.max(0, originalSalary - totalSalaryDeduction);

  // Create the final summary in the requested format
  const finalSummary = {
    "Total Days in Period": totalDaysInPeriod,
    "Total Working Days": totalWorkingDaysInPeriod,
    "Total Sundays": totalSundaysInPeriod,
    "Total Absent Days": totalAbsentDays,
    "Actual Working Days": actualWorkingDays,
    "Total Working Hours": `${(totalWorkingMinutes / 60).toFixed(2)} hours`,
    "Total Permission Time": `${Math.round(totalPermissionMinutes)} minutes`,
    "Absent Deduction": formatCurrency(totalAbsentDeduction),
    "Permission Deduction": formatCurrency(totalPermissionDeduction),
    "Total Salary Deductions": formatCurrency(totalSalaryDeduction),
    "Attendance Rate": `${attendanceRate.toFixed(1)}%`,
    "Final Salary": formatCurrency(finalSalary)
  };

  return {
    // Original structure maintained for backward compatibility
    totalDays,
    workingDays: actualWorkingDays,
    totalWorkingHours: totalWorkingMinutes / 60,
    averageWorkingHours,
    totalPermissionTime: totalPermissionMinutes,
    totalSalaryDeduction,
    totalAbsentDays,
    totalSundayCount: totalSundaysInPeriod,
    productivityPercentage,
    dailyBreakdown: dailyBreakdown.map(day => ({
      ...day,
      workingHours: day.workingMinutes / 60,
      permissionTime: day.permissionMinutes,
      workingTimeDisplay: day.workingMinutes > 0 ? minutesToTime(day.workingMinutes) : '-',
      permissionTimeDisplay: day.permissionMinutes > 0 ? minutesToTime(day.permissionMinutes) : '-',
      daySalaryFromMinutes: day.workingMinutes * perMinuteSalary,
      expectedDaySalary: perDaySalary
    })),
    summary: {
      punctualityScore,
      attendanceRate,
      finalSalary,
      originalSalary,
      originalSalaryForPeriod: originalSalary,
      salaryFromWorkingMinutes,
      perMinuteSalary,
      perDaySalary,
      totalWorkingDaysInPeriod,
      totalDaysInPeriod,
      totalSundaysInPeriod,
      totalAbsentDays,
      actualWorkingDays,
      absentDeduction: totalAbsentDeduction,
      permissionDeduction: totalPermissionDeduction,
      worker: {
        name: worker.name || '',
        username: worker.username || '',
        rfid: worker.rfid || '',
        department: worker.department || '',
        email: worker.email || '',
        salary: worker.salary || 0
      }
    },
    configuration: {
      considerOvertime,
      deductSalary,
      workStartTime,
      workEndTime,
      lunchStartTime: lunchFrom,
      lunchEndTime: lunchTo,
      permissionTimeMinutes,
      salaryDeductionPerBreak,
      standardWorkingMinutesPerDay: standardWorkingMinutes
    },
    // New formatted data as requested
    finalSummary,
    report: report.sort((a, b) => new Date(a.date) - new Date(b.date))
  };
};

function emptyResponse() {
  return {
    totalDays: 0,
    workingDays: 0,
    totalWorkingHours: 0,
    averageWorkingHours: 0,
    totalPermissionTime: 0,
    totalSalaryDeduction: 0,
    totalAbsentDays: 0,
    totalSundayCount: 0,
    productivityPercentage: 0,
    dailyBreakdown: [],
    summary: {
      punctualityScore: 0,
      attendanceRate: 0,
      finalSalary: 0,
      originalSalary: 0,
      perMinuteSalary: 0,
      totalWorkingDaysInPeriod: 0,
      totalDaysInPeriod: 0,
      totalSundaysInPeriod: 0,
      totalAbsentDays: 0,
      actualWorkingDays: 0,
      absentDeduction: 0,
      permissionDeduction: 0,
      worker: {
        name: '',
        username: '',
        rfid: '',
        department: '',
        email: '',
        perDaySalary: 0
      }
    },
    configuration: {},
    finalSummary: {
      "Total Days in Period": 0,
      "Total Working Days": 0,
      "Total Sundays": 0,
      "Total Absent Days": 0,
      "Actual Working Days": 0,
      "Total Working Hours": "0 hours",
      "Total Permission Time": "0 minutes",
      "Absent Deduction": "₹0.00",
      "Attendance Rate": "0%",
      "Permission Deduction": "₹0.00",
      "Total Salary Deductions": "₹0.00",
      "Final Salary": "₹0.00"
    },
    report: []
  };
}