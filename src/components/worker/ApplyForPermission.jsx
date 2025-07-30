import { useContext, useState } from 'react';
import { toast } from 'react-toastify';
import Card from '../common/Card';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import appContext from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { createPermission } from '../../services/permissionService';

const PermissionRequests = () => {
    const { subdomain } = useContext(appContext);
    const { user } = useAuth();

    const [formData, setFormData] = useState({
        permissionDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '12:00',
        reason: '',
        rfid: user?.rfid,
        worker: user?._id,
        subdomain
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!subdomain || subdomain === 'main') {
            toast.error('Subdomain is missing, check the URL');
            return;
        }

        const { permissionDate, startTime, endTime, reason } = formData;

        if (!permissionDate || !startTime || !endTime || !reason) {
            toast.error('Please fill in all required fields');
            return;
        }

        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        if (start >= end) {
            toast.error('Start time must be earlier than end time');
            return;
        }

        setIsSubmitting(true);

        try {
            // Log form data instead of submitting to server
            console.log('Permission Request Submitted:', {
                subdomain,
                ...formData
            });

            createPermission({
                subdomain,
                ...formData
            })
                .then(response => {
                    console.log(response);
                    toast.success(response.message);
                })
                .catch(e => {
                    console.log(e.message);
                    toast.error(e.message);
                });


            // Reset form
            setFormData({
                permissionDate: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                endTime: '12:00',
                reason: '',
                rfid: user?.rfid,
                worker: user?._id,
                subdomain
            });
        } catch (error) {
            toast.error(error.message || 'Failed to log permission request');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Request Permission</h1>

            <Card>
                <form onSubmit={handleSubmit}>
                    {/* Permission Date */}
                    <div className="form-group mb-6">
                        <label htmlFor="permissionDate" className="form-label">Permission Date</label>
                        <input
                            type="date"
                            id="permissionDate"
                            name="permissionDate"
                            className="form-input"
                            value={formData.permissionDate}
                            onChange={handleChange}
                            min={new Date().toISOString().split('T')[0]}
                            required
                        />
                    </div>

                    {/* Start Time and End Time in one row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="form-group">
                            <label htmlFor="startTime" className="form-label">Start Time</label>
                            <input
                                type="time"
                                id="startTime"
                                name="startTime"
                                className="form-input"
                                value={formData.startTime}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="endTime" className="form-label">End Time</label>
                            <input
                                type="time"
                                id="endTime"
                                name="endTime"
                                className="form-input"
                                value={formData.endTime}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="form-group mb-6">
                        <label htmlFor="reason" className="form-label">Reason</label>
                        <textarea
                            id="reason"
                            name="reason"
                            className="form-input"
                            rows="4"
                            value={formData.reason}
                            onChange={handleChange}
                            placeholder="Provide details about your permission request"
                            required
                        ></textarea>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <Spinner size="sm" /> : 'Submit Permission Request'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default PermissionRequests;
